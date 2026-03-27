// ============================================================
// Mandala Governance — Observability Service
// Surfaces current state, intervention needs, and activity metrics
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import { PolicyEngine } from './policy-engine.js';
import { ApprovalQueue } from './approval-queue.js';
import { ActionLogger } from './action-logger.js';
import type { MandalaObservability, InterventionItem } from '../types/governance.js';

export class ObservabilityService {
  private static instance: ObservabilityService;
  private policyEngine = PolicyEngine.getInstance();
  private approvalQueue = ApprovalQueue.getInstance();
  private logger = ActionLogger.getInstance();

  static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  /**
   * Get full observability snapshot for a tenant.
   */
  async getSnapshot(tenantId: string): Promise<MandalaObservability> {
    const [
      config,
      conversationStats,
      pendingApprovals,
      actionsLastHour,
      messagesSentLastHour,
      flagsToday,
      interventions,
    ] = await Promise.all([
      this.policyEngine.getConfig(tenantId),
      this.getConversationStats(tenantId),
      this.approvalQueue.getPending(tenantId),
      this.logger.countSince(tenantId, 'message_sent', new Date(Date.now() - 3_600_000)),
      this.logger.countSince(tenantId, 'message_sent', new Date(Date.now() - 3_600_000)),
      this.getFlagCountToday(tenantId),
      this.getInterventions(tenantId),
    ]);

    return {
      tenant_id: tenantId,
      active_conversations: conversationStats.active,
      mandala_handling: conversationStats.mandala_handling,
      owner_handling: conversationStats.owner_handling,
      pending_approvals: pendingApprovals.length,
      actions_last_hour: actionsLastHour,
      messages_sent_last_hour: messagesSentLastHour,
      flags_raised_today: flagsToday,
      autonomy_level: config.autonomy_level,
      intervention_needed: interventions,
    };
  }

  private async getConversationStats(tenantId: string): Promise<{
    active: number;
    mandala_handling: number;
    owner_handling: number;
  }> {
    const db = getSupabase();

    const { data, error } = await db
      .from('mandala_conversations')
      .select('current_handler')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (error || !data) {
      return { active: 0, mandala_handling: 0, owner_handling: 0 };
    }

    return {
      active: data.length,
      mandala_handling: data.filter((c) => c.current_handler === 'mandala').length,
      owner_handling: data.filter(
        (c) => c.current_handler === 'owner' || c.current_handler === 'admin'
      ).length,
    };
  }

  private async getFlagCountToday(tenantId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.logger.countSince(tenantId, 'flag_raised', todayStart);
  }

  private async getInterventions(tenantId: string): Promise<InterventionItem[]> {
    const items: InterventionItem[] = [];

    // Pending approvals
    const pending = await this.approvalQueue.getPending(tenantId, 10);
    for (const p of pending) {
      items.push({
        type: 'pending_approval',
        conversation_id: p.conversation_id || undefined,
        summary: p.summary,
        priority: p.priority,
        created_at: new Date(p.created_at),
      });
    }

    // Recent flags (last 24h)
    const recentFlags = await this.logger.getRecent(tenantId, {
      action_type: 'flag_raised',
      limit: 5,
      unreviewed_only: true,
    });
    for (const f of recentFlags) {
      items.push({
        type: 'flag_raised',
        conversation_id: f.conversation_id || undefined,
        summary: f.summary,
        priority: 'high',
        created_at: new Date(f.created_at),
      });
    }

    // Rate limit warnings
    const config = await this.policyEngine.getConfig(tenantId);
    const msgRate = await this.policyEngine.checkRateLimit(tenantId, 'message_sent', config);
    if (msgRate.current >= msgRate.limit * 0.8 && msgRate.limit > 0) {
      items.push({
        type: 'rate_limit_near',
        summary: `Message rate at ${msgRate.current}/${msgRate.limit} per hour`,
        priority: msgRate.current >= msgRate.limit ? 'critical' : 'high',
        created_at: new Date(),
      });
    }

    // Sort by priority then recency
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    items.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return items;
  }
}
