import { Hono } from 'hono';
import { ConversationStore } from '../memory/conversation-store.js';
import { HandoffTimer } from '../queue/handoff-timer.js';
import { HunterPipeline } from '../hunter/index.js';
import { HunterScheduler } from '../hunter/scheduler.js';
import { TaskExecutor } from '../task/executor.js';
import { TargetIntel } from '../task/target-intel.js';
import { getSupabase } from '../memory/supabase-client.js';
import type { TaskInput, TaskType } from '../task/types.js';

export const apiRoutes = new Hono();

const store = ConversationStore.getInstance();

// List all conversations (for CRM dashboard)
apiRoutes.get('/conversations', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const status = c.req.query('status');
  const conversations = await store.listByTenant(tenant, status);

  return c.json({
    conversations: conversations.map((conv) => ({
      id: conv.id,
      customer_number: conv.customer_number,
      customer_name: conv.customer_name,
      status: conv.status,
      current_handler: conv.current_handler,
      mode: conv.mode,
      phase: conv.phase,
      lead_score: conv.lead_score,
      temperature: getTemperature(conv.lead_score),
      last_message_at: conv.last_message_at,
      message_count: conv.messages.length,
    })),
  });
});

// Get single conversation with full history
apiRoutes.get('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const conv = await store.get(id);

  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  return c.json({ conversation: conv });
});

// Manual takeover — Owner takes over from Mandala
apiRoutes.post('/takeover/:id', async (c) => {
  const id = c.req.param('id');
  const conv = await store.get(id);

  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  HandoffTimer.getInstance().cancel(id);
  conv.current_handler = 'owner';
  await store.update(conv);

  console.log(`[takeover] Owner took over conversation ${id}`);
  return c.json({ status: 'taken_over', conversation_id: id });
});

// Let Mandala handle — Owner approves Mandala to continue
apiRoutes.post('/let-mandala/:id', async (c) => {
  const id = c.req.param('id');
  const conv = await store.get(id);

  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  conv.current_handler = 'mandala';
  await store.update(conv);

  return c.json({ status: 'mandala_handling', conversation_id: id });
});

// Get lead pipeline
apiRoutes.get('/leads', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const temperature = c.req.query('temperature');
  const conversations = await store.listByTenant(tenant);

  const leads = conversations
    .filter((conv) => conv.mode === 'sales-shadow')
    .filter((conv) => !temperature || getTemperature(conv.lead_score) === temperature)
    .map((conv) => ({
      conversation_id: conv.id,
      customer_number: conv.customer_number,
      customer_name: conv.customer_name,
      score: conv.lead_score,
      temperature: getTemperature(conv.lead_score),
      phase: conv.phase,
      status: conv.status,
      last_message_at: conv.last_message_at,
    }))
    .sort((a, b) => b.score - a.score);

  return c.json({ leads });
});

// Stats endpoint
apiRoutes.get('/stats', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const stats = await store.stats(tenant);
  return c.json({ stats });
});

// ══════════════════════════════════════════
// HUNTER API ROUTES
// ══════════════════════════════════════════

// List hunter prospects
apiRoutes.get('/hunter/prospects', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const status = c.req.query('status');
  const decision = c.req.query('decision');

  const db = getSupabase();
  let query = db
    .from('mandala_hunter_prospects')
    .select('id, business_name, address, phone, rating, review_count, website, status, decision, pain_type, pain_score, contacted_at, created_at')
    .eq('tenant_id', tenant)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) query = query.eq('status', status);
  if (decision) query = query.eq('decision', decision);

  const { data } = await query;
  return c.json({ prospects: data || [] });
});

// Get single prospect with full data
apiRoutes.get('/hunter/prospects/:id', async (c) => {
  const id = c.req.param('id');
  const db = getSupabase();
  const { data } = await db
    .from('mandala_hunter_prospects')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) {
    return c.json({ error: 'Prospect not found' }, 404);
  }

  return c.json({ prospect: data });
});

// Trigger manual hunter run
apiRoutes.post('/hunter/run', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const query = body.query;
  const tenant = body.tenant || 'mandala';
  const batchSize = body.batch_size || 20;

  if (!query) {
    return c.json({ error: 'Missing "query" in request body' }, 400);
  }

  const pipeline = HunterPipeline.getInstance();

  // Run async — don't block the response
  pipeline.run(query, tenant, {
    batchSize,
    classifierModel: body.classifier_model || 'gemini-2.0-flash',
    conversationModel: body.conversation_model || 'gemini-2.5-pro',
    autoContact: body.auto_contact || false,
  }).catch((err) => console.error('[hunter/run] Pipeline error:', err));

  return c.json({
    status: 'started',
    query,
    tenant,
    batch_size: batchSize,
  });
});

// Get hunter stats
apiRoutes.get('/hunter/stats', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const pipeline = HunterPipeline.getInstance();
  const stats = await pipeline.getStats(tenant);
  return c.json({ stats });
});

// Trigger scheduler cycle manually
apiRoutes.post('/hunter/trigger', async (c) => {
  const scheduler = HunterScheduler.getInstance();
  if (scheduler.isRunning()) {
    return c.json({ status: 'already_running' });
  }

  scheduler.runCycle().catch((err) => console.error('[hunter/trigger] Error:', err));
  return c.json({ status: 'triggered' });
});

// ══════════════════════════════════════════
// TASK EXECUTION PROTOCOL API ROUTES
// ══════════════════════════════════════════

const taskExecutor = TaskExecutor.getInstance();
const targetIntel = TargetIntel.getInstance();

// Execute a new task through the full 5-stage pipeline
apiRoutes.post('/task/execute', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const { task_type, target_number, objective, context, contact_name, tenant } = body;

  if (!target_number || !objective) {
    return c.json({ error: 'Missing required fields: target_number, objective' }, 400);
  }

  const validTypes: TaskType[] = ['outreach', 'follow_up', 'rescue', 'qualification'];
  const resolvedType = validTypes.includes(task_type) ? task_type : 'outreach';

  const input: TaskInput = {
    task_type: resolvedType,
    target_number,
    objective_raw: objective,
    context_extra: context,
    contact_name,
    tenant_id: tenant || 'mandala',
  };

  // Execute async — return task ID immediately
  const taskPromise = taskExecutor.execute(input);

  // Wait briefly to get initial state (parse + validate is fast)
  const state = await Promise.race([
    taskPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

  if (state) {
    return c.json({
      task_id: state.id,
      status: state.status,
      clarification: state.clarification,
      report: state.report,
      escalation: state.escalation,
    });
  }

  // If still running after 5s, return pending
  return c.json({
    task_id: 'pending',
    status: 'processing',
    message: 'Task is being processed. Check /api/task/:id for status.',
  }, 202);
});

// Resume a task that needs clarification
apiRoutes.post('/task/:id/resume', async (c) => {
  const taskId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const response = body.response || body.answer;

  if (!response) {
    return c.json({ error: 'Missing "response" in body' }, 400);
  }

  try {
    const state = await taskExecutor.resume(taskId, response);
    return c.json({
      task_id: state.id,
      status: state.status,
      report: state.report,
      escalation: state.escalation,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Get task state
apiRoutes.get('/task/:id', async (c) => {
  const taskId = c.req.param('id');
  const db = getSupabase();
  const { data } = await db
    .from('mandala_task_states')
    .select('*')
    .eq('id', taskId)
    .single();

  if (!data) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({ task: data });
});

// List recent tasks
apiRoutes.get('/tasks', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const status = c.req.query('status');
  const db = getSupabase();

  let query = db
    .from('mandala_task_states')
    .select('id, status, input, created_at, updated_at')
    .eq('tenant_id', tenant)
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) query = query.eq('status', status);

  const { data } = await query;
  return c.json({ tasks: data || [] });
});

// Get target intel before executing a task
apiRoutes.get('/task/intel/:number', async (c) => {
  const number = c.req.param('number');
  const tenant = c.req.query('tenant') || 'mandala';

  const profile = await targetIntel.gather(number, tenant);
  return c.json({ profile });
});

// ══════════════════════════════════════════

function getTemperature(score: number): string {
  if (score >= 70) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 30) return 'lukewarm';
  if (score >= 0) return 'cold';
  return 'not_fit';
}
