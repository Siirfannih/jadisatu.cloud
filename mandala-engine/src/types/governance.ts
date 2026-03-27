// ============================================================
// Mandala Platform — Governance Types
// Issue #23: Safety, Governance, Permissions, Observability
// ============================================================

// === Autonomy & Approval ===

export type AutonomyLevel = 'supervised' | 'semi_autonomous' | 'autonomous';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';

export type ApprovalPriority = 'critical' | 'high' | 'normal' | 'low';

export type EscalationAction = 'pause' | 'flag_owner' | 'auto_approve' | 'reject';

// === Action Types (audit trail) ===

export type ActionType =
  | 'message_sent'
  | 'message_held'
  | 'phase_advanced'
  | 'score_updated'
  | 'handoff_triggered'
  | 'hunter_run'
  | 'hunter_contact'
  | 'conversation_created'
  | 'conversation_closed'
  | 'flag_raised'
  | 'approval_requested'
  | 'approval_resolved'
  | 'escalation_triggered'
  | 'config_changed'
  | 'role_changed'
  | 'takeover'
  | 'release';

export type ActionActor = 'mandala' | 'owner' | 'operator' | 'system';

// === Roles ===

export type MandalaRole = 'owner' | 'operator' | 'viewer';

export interface RoleAssignment {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MandalaRole;
  granted_by?: string;
  created_at: Date;
}

// === Governance Config ===

export interface GovernanceConfig {
  id: string;
  tenant_id: string;
  autonomy_level: AutonomyLevel;
  approval_required_actions: string[];
  escalation_timeout_seconds: number;
  escalation_action: EscalationAction;
  max_messages_per_hour: number;
  max_conversations_per_day: number;
  max_hunter_contacts_per_day: number;
  blocked_keywords: string[];
  require_review_for_new_contacts: boolean;
  auto_release_after_seconds: number;
  owner_can_override_pause: boolean;
  created_at: Date;
  updated_at: Date;
}

// === Action Log Entry ===

export interface ActionLogEntry {
  id: string;
  tenant_id: string;
  action_type: ActionType;
  conversation_id?: string;
  actor: ActionActor;
  actor_id?: string;
  summary: string;
  decision_reason?: string;
  target?: string;
  details: Record<string, unknown>;
  requires_review: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
  review_outcome?: 'approved' | 'rejected' | 'noted';
  created_at: Date;
}

// === Approval Queue Item ===

export interface ApprovalQueueItem {
  id: string;
  tenant_id: string;
  action_type: string;
  conversation_id?: string;
  target?: string;
  summary: string;
  decision_reason?: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  resolved_by?: string;
  resolved_at?: Date;
  resolution_note?: string;
  expires_at: Date;
  action_log_id?: string;
  created_at: Date;
}

// === Policy Decision ===

export interface PolicyDecision {
  allowed: boolean;
  requires_approval: boolean;
  reason: string;
  priority?: ApprovalPriority;
}

// === Observability Surface ===

export interface MandalaObservability {
  tenant_id: string;
  // Current state
  active_conversations: number;
  mandala_handling: number;
  owner_handling: number;
  pending_approvals: number;
  // Recent activity
  actions_last_hour: number;
  messages_sent_last_hour: number;
  flags_raised_today: number;
  // Governance state
  autonomy_level: AutonomyLevel;
  // Active items needing attention
  intervention_needed: InterventionItem[];
}

export interface InterventionItem {
  type: 'pending_approval' | 'flag_raised' | 'escalation' | 'rate_limit_near';
  conversation_id?: string;
  summary: string;
  priority: ApprovalPriority;
  created_at: Date;
}

// === Rate Limit Check ===

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
  resets_at?: Date;
}
