// ============================================================
// Mandala Governance — Action Logger
// Comprehensive audit trail for all Mandala decisions
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import type { ActionType, ActionActor, ActionLogEntry } from '../types/governance.js';

export interface LogActionParams {
  tenant_id: string;
  action_type: ActionType;
  conversation_id?: string;
  actor?: ActionActor;
  actor_id?: string;
  summary: string;
  decision_reason?: string;
  target?: string;
  details?: Record<string, unknown>;
  requires_review?: boolean;
}

export class ActionLogger {
  private static instance: ActionLogger;

  static getInstance(): ActionLogger {
    if (!ActionLogger.instance) {
      ActionLogger.instance = new ActionLogger();
    }
    return ActionLogger.instance;
  }

  async log(params: LogActionParams): Promise<string | null> {
    try {
      const db = getSupabase();
      const { data, error } = await db
        .from('mandala_action_log')
        .insert({
          tenant_id: params.tenant_id,
          action_type: params.action_type,
          conversation_id: params.conversation_id || null,
          actor: params.actor || 'mandala',
          actor_id: params.actor_id || 'mandala-engine',
          summary: params.summary,
          decision_reason: params.decision_reason || null,
          target: params.target || null,
          details: params.details || {},
          requires_review: params.requires_review || false,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[action-logger] Failed to log action:', error.message);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      // Non-blocking: logging should never break the main flow
      console.error('[action-logger] Error:', err);
      return null;
    }
  }

  async markReviewed(
    logId: string,
    reviewedBy: string,
    outcome: 'approved' | 'rejected' | 'noted'
  ): Promise<void> {
    try {
      const db = getSupabase();
      await db
        .from('mandala_action_log')
        .update({
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          review_outcome: outcome,
        })
        .eq('id', logId);
    } catch (err) {
      console.error('[action-logger] markReviewed error:', err);
    }
  }

  async getRecent(
    tenantId: string,
    options?: {
      limit?: number;
      action_type?: ActionType;
      conversation_id?: string;
      unreviewed_only?: boolean;
    }
  ): Promise<ActionLogEntry[]> {
    const db = getSupabase();
    let query = db
      .from('mandala_action_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.action_type) {
      query = query.eq('action_type', options.action_type);
    }
    if (options?.conversation_id) {
      query = query.eq('conversation_id', options.conversation_id);
    }
    if (options?.unreviewed_only) {
      query = query.eq('requires_review', true).is('reviewed_at', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[action-logger] getRecent error:', error.message);
      return [];
    }

    return (data || []) as ActionLogEntry[];
  }

  async countSince(
    tenantId: string,
    actionType: ActionType,
    sinceDate: Date
  ): Promise<number> {
    const db = getSupabase();
    const { count, error } = await db
      .from('mandala_action_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('action_type', actionType)
      .gte('created_at', sinceDate.toISOString());

    if (error) {
      console.error('[action-logger] countSince error:', error.message);
      return 0;
    }

    return count || 0;
  }
}
