// ============================================================
// Mandala Governance — Policy Engine
// Decides whether an action requires approval, is blocked,
// or can proceed automatically based on governance config
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import { ActionLogger } from './action-logger.js';
import type {
  GovernanceConfig,
  PolicyDecision,
  ActionType,
  ApprovalPriority,
  RateLimitResult,
} from '../types/governance.js';

const CONFIG_CACHE_TTL = 60_000; // 1 minute

export class PolicyEngine {
  private static instance: PolicyEngine;
  private configCache = new Map<string, { config: GovernanceConfig; loadedAt: number }>();
  private logger = ActionLogger.getInstance();

  static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  async getConfig(tenantId: string): Promise<GovernanceConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < CONFIG_CACHE_TTL) {
      return cached.config;
    }

    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_governance_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      // Return safe defaults if no config exists
      const defaults = this.safeDefaults(tenantId);
      this.configCache.set(tenantId, { config: defaults, loadedAt: Date.now() });
      return defaults;
    }

    const config = data as GovernanceConfig;
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<GovernanceConfig>,
    actorId: string
  ): Promise<GovernanceConfig> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_governance_config')
      .upsert({
        tenant_id: tenantId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update governance config: ${error.message}`);
    }

    // Invalidate cache
    this.configCache.delete(tenantId);

    // Audit log
    await this.logger.log({
      tenant_id: tenantId,
      action_type: 'config_changed',
      actor: 'owner',
      actor_id: actorId,
      summary: `Governance config updated: ${Object.keys(updates).join(', ')}`,
      details: updates as Record<string, unknown>,
    });

    return data as GovernanceConfig;
  }

  /**
   * Evaluate whether a proposed action is allowed, needs approval, or is blocked.
   */
  async evaluate(
    tenantId: string,
    actionType: ActionType,
    context?: { conversation_id?: string; target?: string }
  ): Promise<PolicyDecision> {
    const config = await this.getConfig(tenantId);

    // Rate limit check first
    const rateLimit = await this.checkRateLimit(tenantId, actionType, config);
    if (!rateLimit.allowed) {
      return {
        allowed: false,
        requires_approval: false,
        reason: `Rate limit exceeded: ${rateLimit.current}/${rateLimit.limit} ${rateLimit.resource}`,
      };
    }

    // Autonomous mode: everything proceeds (with logging)
    if (config.autonomy_level === 'autonomous') {
      return { allowed: true, requires_approval: false, reason: 'Autonomous mode' };
    }

    // Supervised mode: everything needs approval
    if (config.autonomy_level === 'supervised') {
      const priority = this.inferPriority(actionType);
      return {
        allowed: true,
        requires_approval: true,
        reason: 'Supervised mode — all actions require approval',
        priority,
      };
    }

    // Semi-autonomous: check if this action type needs approval
    if (config.approval_required_actions.includes(actionType)) {
      const priority = this.inferPriority(actionType);
      return {
        allowed: true,
        requires_approval: true,
        reason: `Action "${actionType}" requires approval in semi-autonomous mode`,
        priority,
      };
    }

    // Semi-autonomous: new contacts need review?
    if (
      config.require_review_for_new_contacts &&
      (actionType === 'conversation_created' || actionType === 'hunter_contact')
    ) {
      return {
        allowed: true,
        requires_approval: true,
        reason: 'New contact requires review',
        priority: 'normal',
      };
    }

    return { allowed: true, requires_approval: false, reason: 'Allowed by policy' };
  }

  async checkRateLimit(
    tenantId: string,
    actionType: ActionType,
    config?: GovernanceConfig
  ): Promise<RateLimitResult> {
    const cfg = config || (await this.getConfig(tenantId));

    if (actionType === 'message_sent') {
      const oneHourAgo = new Date(Date.now() - 3_600_000);
      const count = await this.logger.countSince(tenantId, 'message_sent', oneHourAgo);
      return {
        allowed: count < cfg.max_messages_per_hour,
        current: count,
        limit: cfg.max_messages_per_hour,
        resource: 'messages/hour',
      };
    }

    if (actionType === 'conversation_created') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const count = await this.logger.countSince(tenantId, 'conversation_created', todayStart);
      return {
        allowed: count < cfg.max_conversations_per_day,
        current: count,
        limit: cfg.max_conversations_per_day,
        resource: 'conversations/day',
      };
    }

    if (actionType === 'hunter_contact') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const count = await this.logger.countSince(tenantId, 'hunter_contact', todayStart);
      return {
        allowed: count < cfg.max_hunter_contacts_per_day,
        current: count,
        limit: cfg.max_hunter_contacts_per_day,
        resource: 'hunter contacts/day',
      };
    }

    // No rate limit for other actions
    return { allowed: true, current: 0, limit: -1, resource: 'none' };
  }

  /**
   * Check if message content contains blocked keywords.
   */
  async checkContentSafety(tenantId: string, content: string): Promise<{ safe: boolean; blocked_keyword?: string }> {
    const config = await this.getConfig(tenantId);
    if (config.blocked_keywords.length === 0) return { safe: true };

    const lowerContent = content.toLowerCase();
    for (const keyword of config.blocked_keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return { safe: false, blocked_keyword: keyword };
      }
    }
    return { safe: true };
  }

  private inferPriority(actionType: ActionType): ApprovalPriority {
    switch (actionType) {
      case 'hunter_contact':
      case 'hunter_run':
        return 'high';
      case 'conversation_closed':
      case 'phase_advanced':
        return 'normal';
      case 'message_sent':
        return 'normal';
      default:
        return 'low';
    }
  }

  private safeDefaults(tenantId: string): GovernanceConfig {
    return {
      id: '',
      tenant_id: tenantId,
      autonomy_level: 'supervised',
      approval_required_actions: [
        'send_cold_message',
        'hunter_run',
        'close_conversation',
        'phase_advance_closing',
      ],
      escalation_timeout_seconds: 300,
      escalation_action: 'pause',
      max_messages_per_hour: 30,
      max_conversations_per_day: 50,
      max_hunter_contacts_per_day: 10,
      blocked_keywords: [],
      require_review_for_new_contacts: true,
      auto_release_after_seconds: 120,
      owner_can_override_pause: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.configCache.delete(tenantId);
    } else {
      this.configCache.clear();
    }
  }
}
