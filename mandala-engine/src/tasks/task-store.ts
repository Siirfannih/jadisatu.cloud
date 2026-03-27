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
      created_by: row.created_by as string,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
      executed_at: row.executed_at ? new Date(row.executed_at as string) : undefined,
    };
  }
}
