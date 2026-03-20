// ============================================================
// State Machine Types — 5-Phase Graduated Scoring
// ============================================================

export type ConversationPhase =
  | 'kenalan'
  | 'gali_masalah'
  | 'tawarkan_solusi'
  | 'closing'
  | 'rescue';

export interface PhaseTransition {
  from: ConversationPhase;
  to: ConversationPhase;
  reason: string;
  score: number;
  timestamp: Date;
}

export interface PhaseConfig {
  phase: ConversationPhase;
  scoreRange: { min: number; max: number };
  skills: string[];       // Relative paths under mandala/ dir
  maxContextMessages: number;
  description: string;
}

export interface EvaluatorResult {
  intent: string;
  buying_signal: number;       // 0-10
  objection: string | null;
  resistance_type: string | null;
  recommended_action: 'continue' | 'advance_phase' | 'rescue' | 'flag_owner' | 'close';
  score_delta: number;         // Points to add/subtract (on 0-100 scale)
  confidence: number;          // 0-1
  reasoning: string;
}

export interface ResistanceSignal {
  type: 'time_stalling' | 'value_mismatch' | 'silence' | 'explicit_rejection' | 'competitor_mention' | 'trust_issue';
  pattern: string;
  score_delta: number;
  action: 'rescue' | 'gentle_followup' | 'graceful_close' | 'continue';
  message_hint?: string;
}

export interface CustomerMemory {
  conversation_id: string;
  tenant_id: string;
  customer_number: string;
  business_name?: string;
  business_type?: string;
  pain_points: string[];
  communication_style: 'formal' | 'casual' | 'mixed';
  budget_indication?: string;
  decision_maker: boolean;
  negotiation_position: 'exploring' | 'interested' | 'comparing' | 'ready' | 'resistant';
  key_facts: string[];
  last_updated: Date;
}
