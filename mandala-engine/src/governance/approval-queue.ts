// ============================================================
// Mandala Governance — Approval Queue
// Manages pending actions that require human approval
// State machine: pending -> approved | rejected | auto_approved | expired
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import { ActionLogger } from './action-logger.js';
import { PolicyEngine } from './policy-engine.js';
import type {
  ApprovalQueueItem,
  ApprovalStatus,
  ApprovalPriority,
  ActionType,
  EscalationAction,
} from '../types/governance.js';

export interface QueueActionParams {
  tenant_id: string;
  action_type: ActionType;
  conversation_id?: string;
  target?: string;
  summary: string;
  decision_reason?: string;
  payload: Record<string, unknown>;
  priority?: ApprovalPriority;
}

export class ApprovalQueue {
  private static instance: ApprovalQueue;
  private logger = ActionLogger.getInstance();
  private policyEngine = PolicyEngine.getInstance();
  private escalationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  static getInstance(): ApprovalQueue {
    if (!ApprovalQueue.instance) {
      ApprovalQueue.instance = new ApprovalQueue();
    }
    return ApprovalQueue.instance;
  }

  /**
   * Add an action to the approval queue. Returns the queue item ID.
   * Starts an escalation timer based on governance config.
   */
  async enqueue(params: QueueActionParams): Promise<string | null> {
    const config = await this.policyEngine.getConfig(params.tenant_id);
    const expiresAt = new Date(Date.now() + config.escalation_timeout_seconds * 1000);

    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_approval_queue')
      .insert({
        tenant_id: params.tenant_id,
        action_type: params.action_type,
        conversation_id: params.conversation_id || null,
        target: params.target || null,
        summary: params.summary,
        decision_reason: params.decision_reason || null,
        payload: params.payload,
        status: 'pending',
        priority: params.priority || 'normal',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[approval-queue] Failed to enqueue:', error.message);
      return null;
    }

    const queueId = data?.id;
    if (!queueId) return null;

    // Log the approval request
    const logId = await this.logger.log({
      tenant_id: params.tenant_id,
      action_type: 'approval_requested',
      conversation_id: params.conversation_id,
      actor: 'mandala',
      summary: `Approval requested: ${params.summary}`,
      decision_reason: params.decision_reason,
      target: params.target,
      details: { queue_id: queueId, action_type: params.action_type, payload: params.payload },
      requires_review: true,
    });

    // Link action log entry
    if (logId) {
      await db
        .from('mandala_approval_queue')
        .update({ action_log_id: logId })
        .eq('id', queueId);
    }

    // Start escalation timer
    this.startEscalationTimer(
      queueId,
      params.tenant_id,
      config.escalation_timeout_seconds,
      config.escalation_action
    );

    console.log(`[approval-queue] Queued: ${params.summary} [${queueId}] expires ${expiresAt.toISOString()}`);
    return queueId;
  }

  /**
   * Approve a pending action.
   */
  async approve(
    queueId: string,
    resolvedBy: string,
    note?: string
  ): Promise<ApprovalQueueItem | null> {
    return this.resolve(queueId, 'approved', resolvedBy, note);
  }

  /**
   * Reject a pending action.
   */
  async reject(
    queueId: string,
    resolvedBy: string,
    note?: string
  ): Promise<ApprovalQueueItem | null> {
    return this.resolve(queueId, 'rejected', resolvedBy, note);
  }

  private async resolve(
    queueId: string,
    status: ApprovalStatus,
    resolvedBy: string,
    note?: string
  ): Promise<ApprovalQueueItem | null> {
    // Cancel escalation timer
    this.cancelEscalationTimer(queueId);

    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_approval_queue')
      .update({
        status,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_note: note || null,
      })
      .eq('id', queueId)
      .eq('status', 'pending') // Only resolve if still pending
      .select('*')
      .single();

    if (error || !data) {
      console.error('[approval-queue] Failed to resolve:', error?.message || 'Not found or already resolved');
      return null;
    }

    const item = data as ApprovalQueueItem;

    // Log resolution
    await this.logger.log({
      tenant_id: item.tenant_id,
      action_type: 'approval_resolved',
      conversation_id: item.conversation_id,
      actor: status === 'auto_approved' ? 'system' : 'operator',
      actor_id: resolvedBy,
      summary: `Approval ${status}: ${item.summary}`,
      details: {
        queue_id: queueId,
        original_action: item.action_type,
        resolution_note: note,
      },
    });

    // Mark linked action log entry as reviewed
    if (item.action_log_id) {
      const outcome = status === 'approved' || status === 'auto_approved' ? 'approved' : 'rejected';
      await this.logger.markReviewed(item.action_log_id, resolvedBy, outcome);
    }

    console.log(`[approval-queue] ${status}: ${item.summary} [${queueId}]`);
    return item;
  }

  /**
   * Get pending items for a tenant.
   */
  async getPending(tenantId: string, limit = 20): Promise<ApprovalQueueItem[]> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_approval_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[approval-queue] getPending error:', error.message);
      return [];
    }

    return (data || []) as ApprovalQueueItem[];
  }

  /**
   * Get recent items (all statuses) for a tenant.
   */
  async getRecent(tenantId: string, limit = 50): Promise<ApprovalQueueItem[]> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_approval_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[approval-queue] getRecent error:', error.message);
      return [];
    }

    return (data || []) as ApprovalQueueItem[];
  }

  /**
   * Expire all overdue pending items.
   */
  async expireOverdue(tenantId: string): Promise<number> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_approval_queue')
      .update({ status: 'expired' })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[approval-queue] expireOverdue error:', error.message);
      return 0;
    }

    return data?.length || 0;
  }

  private startEscalationTimer(
    queueId: string,
    tenantId: string,
    timeoutSeconds: number,
    action: EscalationAction
  ): void {
    const timer = setTimeout(async () => {
      this.escalationTimers.delete(queueId);
      await this.handleEscalation(queueId, tenantId, action);
    }, timeoutSeconds * 1000);

    this.escalationTimers.set(queueId, timer);
  }

  private cancelEscalationTimer(queueId: string): void {
    const timer = this.escalationTimers.get(queueId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(queueId);
    }
  }

  private async handleEscalation(
    queueId: string,
    tenantId: string,
    action: EscalationAction
  ): Promise<void> {
    console.log(`[approval-queue] Escalation triggered for ${queueId}: action=${action}`);

    await this.logger.log({
      tenant_id: tenantId,
      action_type: 'escalation_triggered',
      actor: 'system',
      summary: `Escalation: ${action} for queue item ${queueId}`,
      details: { queue_id: queueId, escalation_action: action },
    });

    switch (action) {
      case 'auto_approve':
        await this.resolve(queueId, 'auto_approved', 'system', 'Escalation timeout — auto-approved');
        break;
      case 'reject':
        await this.resolve(queueId, 'rejected', 'system', 'Escalation timeout — auto-rejected');
        break;
      case 'pause':
        // Leave as pending but mark expired
        await this.expireSingle(queueId);
        break;
      case 'flag_owner':
        // Leave pending, flag will be handled by the caller
        break;
    }
  }

  private async expireSingle(queueId: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_approval_queue')
      .update({ status: 'expired' })
      .eq('id', queueId)
      .eq('status', 'pending');
  }
}
