// ============================================================
// Mandala Task Engine — Type Definitions
// ============================================================

/**
 * Task types that Mandala can execute on behalf of a tenant.
 * Each maps to a distinct execution strategy within the runtime.
 */
export type TaskType =
  | 'outreach'          // Cold outreach to a prospect
  | 'follow_up'         // Follow up on an existing conversation
  | 'rescue'            // Re-engage a stalled/resistant lead
  | 'inbound_response'  // Respond to an inbound message
  | 'qualification';    // Qualify a lead through discovery

/**
 * Approval mode determines how much autonomy Mandala has.
 *
 * - draft_only:  Generate response but do NOT send. Owner must review + approve.
 * - semi_auto:   Send automatically unless flagged (high-risk, low-confidence, etc).
 * - fully_auto:  Send all responses automatically. Owner notified post-hoc.
 */
export type ApprovalMode = 'draft_only' | 'semi_auto' | 'fully_auto';

/**
 * Lifecycle status of a task.
 */
export type TaskStatus =
  | 'pending'       // Queued, not yet started
  | 'in_progress'   // Executor is working on it
  | 'awaiting_review' // Draft generated, waiting for owner approval
  | 'approved'      // Owner approved the draft
  | 'executed'      // Messages sent successfully
  | 'failed'        // Execution error
  | 'cancelled';    // Manually cancelled

/**
 * The target of a task — who or what Mandala should act on.
 */
export interface TaskTarget {
  /** Customer phone number (WhatsApp format) */
  customer_number: string;
  /** Optional display name */
  customer_name?: string;
  /** Existing conversation ID (for follow_up, rescue, inbound_response) */
  conversation_id?: string;
  /** Channel to use */
  channel: 'whatsapp' | 'telegram';
}

/**
 * Constraints that limit what Mandala can do within this task.
 */
export interface TaskConstraints {
  /** Maximum messages Mandala may send in this task */
  max_messages?: number;
  /** Topics/keywords to avoid */
  forbidden_topics?: string[];
  /** Maximum lead score delta allowed per task */
  max_score_delta?: number;
  /** If true, must not mention pricing */
  no_pricing?: boolean;
  /** Tone override (e.g., 'formal', 'casual', 'empathetic') */
  tone?: string;
  /** Language constraint */
  language?: string;
}

/**
 * A single generated draft message within a task.
 */
export interface TaskDraft {
  /** Message content */
  content: string;
  /** Delay before sending (ms) — for natural pacing */
  delay_ms: number;
  /** AI confidence in this message (0-1) */
  confidence: number;
}

/**
 * Log entry for task execution audit trail.
 */
export interface TaskLogEntry {
  timestamp: Date;
  event: string;
  details?: Record<string, unknown>;
}

/**
 * Core task object — the unit of work for the Mandala Task Engine.
 */
export interface MandalaTask {
  id: string;
  tenant_id: string;

  /** What kind of task */
  type: TaskType;

  /** What Mandala should accomplish */
  objective: string;

  /** Who/what to act on */
  target: TaskTarget;

  /** Additional context for the AI (product info, prior interaction notes, etc.) */
  context: string;

  /** Guardrails for execution */
  constraints: TaskConstraints;

  /** How much autonomy Mandala has */
  approval_mode: ApprovalMode;

  /** Current lifecycle status */
  status: TaskStatus;

  /** Generated draft messages (populated during execution) */
  drafts: TaskDraft[];

  /** Execution log */
  log: TaskLogEntry[];

  /** If the task resulted in messages being sent, the conversation ID */
  result_conversation_id?: string;

  /** Error message if status === 'failed' */
  error?: string;

  /** Who created this task */
  created_by: string;

  created_at: Date;
  updated_at: Date;
  executed_at?: Date;
}

/**
 * Input for creating a new task (fields that the caller provides).
 */
export interface CreateTaskInput {
  tenant_id: string;
  type: TaskType;
  objective: string;
  target: TaskTarget;
  context: string;
  constraints?: Partial<TaskConstraints>;
  approval_mode: ApprovalMode;
  created_by: string;
}
