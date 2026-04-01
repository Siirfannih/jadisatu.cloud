// ============================================================
// Mandala Task Engine — Supabase-backed Task Store
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import type {
  MandalaTask,
  CreateTaskInput,
  TaskStatus,
  TaskDraft,
  TaskLogEntry,
  TaskClarification,
  TaskPlan,
  SubTask,
} from './types.js';
import crypto from 'crypto';

export class TaskStore {
  private static instance: TaskStore;

  static getInstance(): TaskStore {
    if (!TaskStore.instance) {
      TaskStore.instance = new TaskStore();
    }
    return TaskStore.instance;
  }

  /**
   * Create a new task and persist it.
   */
  async create(input: CreateTaskInput): Promise<MandalaTask> {
    const now = new Date();
    const task: MandalaTask = {
      id: crypto.randomUUID(),
      tenant_id: input.tenant_id,
      type: input.type,
      objective: input.objective,
      target: input.target,
      context: input.context,
      constraints: {
        max_messages: input.constraints?.max_messages ?? 3,
        forbidden_topics: input.constraints?.forbidden_topics ?? [],
        max_score_delta: input.constraints?.max_score_delta,
        no_pricing: input.constraints?.no_pricing ?? false,
        tone: input.constraints?.tone,
        language: input.constraints?.language ?? 'id',
      },
      approval_mode: input.approval_mode,
      status: 'pending',
      drafts: [],
      log: [{ timestamp: now, event: 'task_created' }],
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };

    const db = getSupabase();
    const { error } = await db.from('mandala_tasks').insert(this.toRow(task));
    if (error) {
      throw new Error(`[task-store] Failed to create task: ${error.message}`);
    }

    console.log(`[task-store] Created task ${task.id} (${task.type}) for tenant ${task.tenant_id}`);
    return task;
  }

  /**
   * Get a task by ID.
   */
  async get(id: string): Promise<MandalaTask | undefined> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return undefined;
    return this.toTask(data);
  }

  /**
   * List tasks for a tenant with optional status filter.
   */
  async listByTenant(
    tenantId: string,
    status?: TaskStatus,
    limit = 50
  ): Promise<MandalaTask[]> {
    const db = getSupabase();
    let query = db
      .from('mandala_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;
    return (data || []).map((row) => this.toTask(row));
  }

  /**
   * Update task status and append a log entry.
   */
  async updateStatus(
    id: string,
    status: TaskStatus,
    details?: Record<string, unknown>
  ): Promise<void> {
    const task = await this.get(id);
    if (!task) return;

    task.status = status;
    task.updated_at = new Date();
    task.log.push({
      timestamp: new Date(),
      event: `status_changed_to_${status}`,
      details,
    });

    if (status === 'executed') {
      task.executed_at = new Date();
    }

    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        status: task.status,
        log: task.log,
        executed_at: task.executed_at?.toISOString() ?? null,
        updated_at: task.updated_at.toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Store generated drafts on a task.
   */
  async setDrafts(id: string, drafts: TaskDraft[]): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        drafts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Set the result conversation ID after execution.
   */
  async setResultConversation(id: string, conversationId: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        result_conversation_id: conversationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Set error on a failed task.
   */
  async setError(id: string, error: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        status: 'failed',
        error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Append a log entry to a task.
   */
  async appendLog(id: string, entry: TaskLogEntry): Promise<void> {
    const task = await this.get(id);
    if (!task) return;

    task.log.push(entry);
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({ log: task.log, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  /**
   * Set or update clarification data on a task.
   */
  async setClarification(id: string, clarification: TaskClarification): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        clarification,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Update task context (used after clarification answers are merged in).
   */
  async updateContext(id: string, newContext: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        context: newContext,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Set or update the execution plan on a task.
   */
  async setPlan(id: string, plan: TaskPlan): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Approve a task's plan. Sets approved flag + timestamp.
   */
  async approvePlan(id: string): Promise<void> {
    const task = await this.get(id);
    if (!task?.plan) throw new Error(`No plan found for task ${id}`);

    task.plan.approved = true;
    task.plan.approved_at = new Date();

    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        plan: task.plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Store subtasks generated from the plan.
   * Also persists to mandala_subtasks table if it exists.
   */
  async setSubtasks(id: string, subtasks: SubTask[]): Promise<void> {
    // Store on the task object
    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        subtasks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Also persist to dedicated subtasks table (best-effort)
    try {
      const rows = subtasks.map(st => ({
        id: st.id,
        task_id: st.parent_task_id,
        tenant_id: '', // Will be set from task
        order_num: st.order,
        objective: st.objective,
        action: st.action,
        status: st.status,
        result: st.result || null,
        created_at: st.created_at.toISOString(),
        executed_at: st.executed_at?.toISOString() || null,
      }));

      // Get tenant_id from parent task
      const task = await this.get(id);
      if (task) {
        for (const row of rows) {
          row.tenant_id = task.tenant_id;
        }
      }

      await db.from('mandala_subtasks').upsert(rows);
    } catch {
      // mandala_subtasks table may not exist yet — non-fatal
    }
  }

  /**
   * Update a single subtask's status and result.
   */
  async updateSubtask(
    taskId: string,
    subtaskId: string,
    updates: { status: TaskStatus; result?: string; error?: string }
  ): Promise<void> {
    const task = await this.get(taskId);
    if (!task?.subtasks) return;

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;

    subtask.status = updates.status;
    if (updates.result) subtask.result = updates.result;
    if (updates.error) subtask.error = updates.error;
    if (updates.status === 'executed') subtask.executed_at = new Date();

    const db = getSupabase();
    await db
      .from('mandala_tasks')
      .update({
        subtasks: task.subtasks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    // Also update dedicated table (best-effort)
    try {
      await db
        .from('mandala_subtasks')
        .update({
          status: updates.status,
          result: updates.result || null,
          executed_at: updates.status === 'executed' ? new Date().toISOString() : null,
        })
        .eq('id', subtaskId);
    } catch {
      // non-fatal
    }
  }

  // ── Row conversion ──

  private toRow(task: MandalaTask) {
    return {
      id: task.id,
      tenant_id: task.tenant_id,
      type: task.type,
      objective: task.objective,
      target: task.target,
      context: task.context,
      constraints: task.constraints,
      approval_mode: task.approval_mode,
      status: task.status,
      drafts: task.drafts,
      log: task.log,
      result_conversation_id: task.result_conversation_id ?? null,
      error: task.error ?? null,
      clarification: task.clarification ?? null,
      plan: task.plan ?? null,
      subtasks: task.subtasks ?? null,
      created_by: task.created_by,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString(),
      executed_at: task.executed_at?.toISOString() ?? null,
    };
  }

  private toTask(row: Record<string, unknown>): MandalaTask {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      type: row.type as MandalaTask['type'],
      objective: row.objective as string,
      target: row.target as MandalaTask['target'],
      context: row.context as string,
      constraints: row.constraints as MandalaTask['constraints'],
      approval_mode: row.approval_mode as MandalaTask['approval_mode'],
      status: row.status as MandalaTask['status'],
      drafts: (row.drafts as MandalaTask['drafts']) || [],
      log: (row.log as MandalaTask['log']) || [],
      result_conversation_id: row.result_conversation_id as string | undefined,
      error: row.error as string | undefined,
      clarification: row.clarification as MandalaTask['clarification'],
      plan: row.plan as MandalaTask['plan'],
      subtasks: row.subtasks as MandalaTask['subtasks'],
      created_by: row.created_by as string,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
      executed_at: row.executed_at ? new Date(row.executed_at as string) : undefined,
    };
  }
}
