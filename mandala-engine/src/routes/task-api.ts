// ============================================================
// Mandala Task Engine — API Routes
// ============================================================

import { Hono } from 'hono';
import { TaskStore } from '../tasks/task-store.js';
import { TaskExecutor } from '../tasks/task-executor.js';
import type { CreateTaskInput, TaskType, TaskStatus, ApprovalMode } from '../tasks/types.js';

export const taskRoutes = new Hono();

const taskStore = TaskStore.getInstance();
const taskExecutor = TaskExecutor.getInstance();

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
    // Active tasks (pending, in_progress, awaiting_review) always block
    if (['pending', 'in_progress', 'awaiting_review'].includes(t.status)) return true;
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

  // Execute async — don't block the response
  taskExecutor.execute(task).catch((err) =>
    console.error(`[task-api] Execution error for task ${task.id}:`, err)
  );

  return c.json({
    task: {
      id: task.id,
      type: task.type,
      status: task.status,
      approval_mode: task.approval_mode,
      created_at: task.created_at,
    },
    message: 'Task created and queued for execution',
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
