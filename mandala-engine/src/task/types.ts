// ============================================================
// Mandala Task Execution Protocol — Types
// Based on: Mandala Task Execution Protocol v1.0
// ============================================================

export type TaskType = 'outreach' | 'follow_up' | 'rescue' | 'qualification';

export type TaskStatus =
  | 'received'
  | 'validating'
  | 'needs_clarification'
  | 'reasoning'
  | 'drafting'
  | 'executing'
  | 'sent'
  | 'tracking'
  | 'completed'
  | 'failed'
  | 'escalated';

export type SuccessLevel = 1 | 2 | 3 | 4 | 5;

export interface TaskInput {
  task_type: TaskType;
  target_number: string;
  objective_raw: string;
  context_extra?: string;
  contact_name?: string;
  tenant_id?: string;
}

export interface ParsedTask {
  task_type: TaskType;
  target_number: string;
  objective_raw: string;
  context_extra?: string;
  contact_history: ContactHistory | null;
  contact_name?: string;
  tenant_id: string;
}

export interface ContactHistory {
  conversation_id: string;
  last_phase: string;
  last_score: number;
  last_message_at: Date;
  total_messages: number;
  was_rejected: boolean;
  follow_up_count: number;
}

export interface ValidationResult {
  valid: boolean;
  status: 'ready' | 'needs_clarification' | 'blocked';
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  issue: string;
  severity: 'blocker' | 'warning' | 'info';
}

export interface ClarificationRequest {
  task_id: string;
  target: string;
  question: string;
  options: string[];
  context: string;
}

export type CustomerEngagementLevel = 'cold' | 'lukewarm' | 'warm' | 'hot';

export interface TaskReasoning {
  real_objective: string;
  target_profile: TargetProfile;
  hook: string;
  strategy: TaskType;
  success_metric: SuccessLevel;
  approach: 'pain_based' | 'curiosity_based' | 'follow_up' | 'rescue';
  messageCountGuidance: number;
  engagementLevel: CustomerEngagementLevel;
}

export interface TargetProfile {
  source: 'hunter_data' | 'conversation_memory' | 'estimated';
  business_name?: string;
  business_type?: string;
  pain_points: string[];
  communication_style: 'formal' | 'casual' | 'mixed' | 'unknown';
  data_completeness: number; // 0-100
}

export interface DraftedMessage {
  parts: MessagePart[];
  self_check: SelfCheckResult;
}

export interface MessagePart {
  content: string;
  delay_seconds: number;
}

export interface SelfCheckResult {
  passed: boolean;
  checks: SelfCheckItem[];
}

export interface SelfCheckItem {
  rule: string;
  passed: boolean;
  detail?: string;
}

export interface TaskReport {
  task_id: string;
  task_type: TaskType;
  target_number: string;
  target_name?: string;
  status: 'sent' | 'failed' | 'delayed';
  messages_sent: string[];
  sent_at?: Date;
  initial_score?: number;
  current_phase?: string;
  next_action: string;
  reasoning_summary: string;
}

export interface EscalationReport {
  task_id: string;
  target_number: string;
  situation: string;
  customer_last_message?: string;
  needed_from_owner: string;
  options: string[];
}

export interface TaskState {
  id: string;
  input: TaskInput;
  status: TaskStatus;
  parsed?: ParsedTask;
  validation?: ValidationResult;
  clarification?: ClarificationRequest;
  reasoning?: TaskReasoning;
  draft?: DraftedMessage;
  report?: TaskReport;
  escalation?: EscalationReport;
  created_at: Date;
  updated_at: Date;
}
