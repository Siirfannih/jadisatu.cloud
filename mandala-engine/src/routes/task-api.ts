// ============================================================
// Mandala Task Engine — API Routes
// ============================================================

import { Hono } from 'hono';
import { TaskStore } from '../tasks/task-store.js';
import { TaskExecutor } from '../tasks/task-executor.js';
import { TaskValidator } from '../tasks/task-validator.js';
import type { CreateTaskInput, TaskType, TaskStatus, ApprovalMode } from '../tasks/types.js';

export const taskRoutes = new Hono();

const taskStore = TaskStore.getInstance();
const taskExecutor = TaskExecutor.getInstance();
const taskValidator = TaskValidator.getInstance();

// Valid values for validation
const VALID_TASK_TYPES: TaskType[] = ['outreach', 'follow_up', 'rescue', 'inbound_response', 'qualification'];
const VALID_APPROVAL_MODES: ApprovalMode[] = ['draft_only', 'semi_auto', 'fully_auto'];
const VALID_CHANNELS = ['whatsapp', 'telegram'] as const;

// ── Create a new task ──
taskRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate required fields
  const { tenant_id, type, objective, target, approval_mode } = body;

  if (!tenant_id || typeof tenant_id !== 'string') {
    return c.json({ error: 'Missing or invalid tenant_id' }, 400);
  }
  if (!type || !VALID_TASK_TYPES.includes(type)) {
    return c.json({ error: `Invalid type. Must be one of: ${VALID_TASK_TYPES.join(', ')}` }, 400);
  }
  if (!objective || typeof objective !== 'string') {
    return c.json({ error: 'Missing or invalid objective' }, 400);
  }
  if (!target || !target.customer_number || typeof target.customer_number !== 'string') {
    return c.json({ error: 'Missing target.customer_number' }, 400);
  }
  if (!target.channel || !VALID_CHANNELS.includes(target.channel)) {
    return c.json({ error: `Invalid target.channel. Must be one of: ${VALID_CHANNELS.join(', ')}` }, 400);
  }
  if (!approval_mode || !VALID_APPROVAL_MODES.includes(approval_mode)) {
    return c.json({ error: `Invalid approval_mode. Must be one of: ${VALID_APPROVAL_MODES.join(', ')}` }, 400);
  }

  // ── Deduplication: check for active/recent tasks for the same customer + type ──
  const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  const existingTasks = await taskStore.listByTenant(tenant_id, undefined, 100);
  const duplicate = existingTasks.find((t) => {
    if (t.target.customer_number !== target.customer_number) return false;
    if (t.type !== type) return false;
    // Active tasks always block
    if (['pending', 'analyzing', 'in_progress', 'awaiting_review', 'needs_clarification', 'planning', 'awaiting_plan_approval'].includes(t.status)) return true;
    // Recently executed tasks within dedup window also block
    if (t.status === 'executed' && t.executed_at) {
      const executedAt = new Date(t.executed_at).getTime();
      if (Date.now() - executedAt < DEDUP_WINDOW_MS) return true;
    }
    return false;
  });

  if (duplicate) {
    return c.json({
      error: 'Duplicate task',
      detail: `A ${type} task for ${target.customer_number} already exists (id: ${duplicate.id}, status: ${duplicate.status})`,
      existing_task_id: duplicate.id,
    }, 409);
  }

  const input: CreateTaskInput = {
    tenant_id,
    type,
    objective,
    target: {
      customer_number: target.customer_number,
      customer_name: target.customer_name,
      conversation_id: target.conversation_id,
      channel: target.channel,
    },
    context: body.context || '',
    constraints: body.constraints || {},
    approval_mode,
    created_by: body.created_by || 'api',
  };

  const task = await taskStore.create(input);

  // Validate task — check if enough context to execute
  const validation = await taskValidator.validate(task);

  if (!validation.valid) {
    // Store clarification questions, set status to needs_clarification
    await taskStore.setClarification(task.id, {
      questions: validation.questions,
      answered: {},
      status: 'pending',
    });
    await taskStore.updateStatus(task.id, 'needs_clarification');

    return c.json({
      task: {
        id: task.id,
        type: task.type,
        status: 'needs_clarification',
        approval_mode: task.approval_mode,
        created_at: task.created_at,
      },
      clarification: validation.questions,
      message: 'Task needs additional information before execution',
    }, 201);
  }

  // ── AI Analysis: deeper ambiguity check + plan generation ──
  // Run analysis asynchronously — returns quickly with task status
  const analyzeAndPlan = async () => {
    try {
      // Step 1: AI analysis for deeper ambiguity detection
      const analysisResult = await taskExecutor.analyzeTask(task);

      if (analysisResult) {
        // Task needs clarification — already updated by analyzeTask
        return;
      }

      // Step 2: Generate execution plan
      await taskExecutor.planTask(task);
      // Task is now in 'awaiting_plan_approval' status
    } catch (err) {
      console.error(`[task-api] Analysis/planning error for task ${task.id}:`, err);
      // Fall back to direct execution if analysis/planning fails
      const refreshed = await taskStore.get(task.id);
      if (refreshed) {
        await taskStore.updateStatus(task.id, 'pending');
        taskExecutor.execute(refreshed).catch((execErr) =>
          console.error(`[task-api] Fallback execution error for task ${task.id}:`, execErr)
        );
      }
    }
  };

  analyzeAndPlan();

  return c.json({
    task: {
      id: task.id,
      type: task.type,
      status: 'analyzing',
      approval_mode: task.approval_mode,
      created_at: task.created_at,
    },
    message: 'Task created — analyzing and generating execution plan',
  }, 201);
});

// ── List tasks for a tenant ──
taskRoutes.get('/', async (c) => {
  const tenant = c.req.query('tenant');
  if (!tenant) {
    return c.json({ error: 'Missing tenant query parameter' }, 400);
  }

  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');

  const tasks = await taskStore.listByTenant(
    tenant,
    status as TaskStatus | undefined,
    limit
  );

  return c.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      type: t.type,
      objective: t.objective,
      status: t.status,
      approval_mode: t.approval_mode,
      target: t.target,
      draft_count: t.drafts.length,
      result_conversation_id: t.result_conversation_id,
      error: t.error,
      clarification: t.clarification,
      created_by: t.created_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
      executed_at: t.executed_at,
    })),
  });
});

// ── Get single task with full details ──
taskRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const task = await taskStore.get(id);

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({ task });
});

// ── Approve a task (send its drafts) ──
taskRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id');

  try {
    await taskExecutor.approve(id);
    return c.json({ status: 'approved_and_executed', task_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// ── Retry a failed/empty task ──
taskRoutes.post('/:id/retry', async (c) => {
  const id = c.req.param('id');

  try {
    await taskExecutor.retry(id);
    return c.json({ status: 'retrying', task_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// ── Cancel a task ──
taskRoutes.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');

  try {
    await taskExecutor.cancel(id);
    return c.json({ status: 'cancelled', task_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// ── Submit clarification answers ──
taskRoutes.post('/:id/clarify', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body?.answers || typeof body.answers !== 'object') {
    return c.json({ error: 'Missing answers object in body' }, 400);
  }

  try {
    const task = await taskStore.get(id);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (task.status !== 'needs_clarification') {
      return c.json({ error: `Task is not awaiting clarification (status: ${task.status})` }, 400);
    }
    if (!task.clarification) {
      return c.json({ error: 'Task has no clarification data' }, 400);
    }

    // Merge new answers into existing
    const clarification = task.clarification;
    clarification.answered = { ...clarification.answered, ...body.answers };

    // Check if all required questions are answered
    const unanswered = clarification.questions.filter(
      (q) => q.required && !clarification.answered[q.field]
    );

    if (unanswered.length > 0) {
      clarification.status = 'pending';
      await taskStore.setClarification(id, clarification);
      return c.json({
        task_id: id,
        status: 'still_needs_clarification',
        remaining: unanswered,
      });
    }

    // All required answers provided — enrich context and generate plan
    clarification.status = 'answered';
    await taskStore.setClarification(id, clarification);

    const enrichedContext = Object.entries(clarification.answered)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const newContext = (task.context || '') + '\n\n# Clarification Answers\n' + enrichedContext;
    await taskStore.updateContext(id, newContext);

    // Re-fetch and generate execution plan (async)
    const refreshed = await taskStore.get(id);
    if (refreshed) {
      taskExecutor.planTask(refreshed).catch((err) =>
        console.error(`[task-api] Planning error for clarified task ${id}:`, err)
      );
    }

    return c.json({
      task_id: id,
      status: 'planning',
      message: 'Clarification received — generating execution plan for approval',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// ── Get task drafts (for review UI) ──
taskRoutes.get('/:id/drafts', async (c) => {
  const id = c.req.param('id');
  const task = await taskStore.get(id);

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({
    task_id: id,
    status: task.status,
    approval_mode: task.approval_mode,
    drafts: task.drafts,
    can_approve: task.status === 'awaiting_review',
    can_cancel: task.status === 'pending' || task.status === 'awaiting_review',
  });
});

// ── Get task execution log ──
taskRoutes.get('/:id/log', async (c) => {
  const id = c.req.param('id');
  const task = await taskStore.get(id);

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({
    task_id: id,
    status: task.status,
    log: task.log,
  });
});

// ── Get execution plan ──
taskRoutes.get('/:id/plan', async (c) => {
  const id = c.req.param('id');
  const task = await taskStore.get(id);

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  if (!task.plan) {
    return c.json({
      task_id: id,
      status: task.status,
      plan: null,
      message: task.status === 'planning'
        ? 'Plan is being generated...'
        : 'No plan generated yet',
    });
  }

  return c.json({
    task_id: id,
    status: task.status,
    plan: {
      approach: task.plan.approach,
      reasoning: task.plan.reasoning,
      steps: task.plan.steps,
      approved: task.plan.approved,
      approved_at: task.plan.approved_at,
      rejection_feedback: task.plan.rejection_feedback,
    },
    subtasks: (task.subtasks || []).map(st => ({
      id: st.id,
      order: st.order,
      action: st.action,
      objective: st.objective,
      status: st.status,
      result: st.result,
      error: st.error,
    })),
    can_approve: task.status === 'awaiting_plan_approval',
    can_reject: task.status === 'awaiting_plan_approval',
  });
});

// ── Approve execution plan ──
taskRoutes.post('/:id/approve-plan', async (c) => {
  const id = c.req.param('id');

  try {
    await taskExecutor.approvePlan(id);
    return c.json({
      task_id: id,
      status: 'in_progress',
      message: 'Plan approved — execution started',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// ── Reject execution plan with feedback ──
taskRoutes.post('/:id/reject-plan', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body?.feedback || typeof body.feedback !== 'string') {
    return c.json({ error: 'Missing feedback string in body' }, 400);
  }

  try {
    const task = await taskStore.get(id);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    if (task.status !== 'awaiting_plan_approval') {
      return c.json({
        error: `Task is not awaiting plan approval (status: ${task.status})`,
      }, 400);
    }

    const newPlan = await taskExecutor.replanTask(task, body.feedback);

    return c.json({
      task_id: id,
      status: 'awaiting_plan_approval',
      message: 'Plan regenerated with feedback — review the new plan',
      plan: {
        approach: newPlan.approach,
        reasoning: newPlan.reasoning,
        steps: newPlan.steps,
        rejection_feedback: newPlan.rejection_feedback,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});
