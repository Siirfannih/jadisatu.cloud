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
  knowledge: string[];    // Knowledge files allowed in this phase (empty = none)
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

// CustomerMemory is now defined in evaluator/memory-updater.ts to match Supabase schema
export type { CustomerMemory } from '../evaluator/memory-updater.js';
