import { getSupabase } from '../memory/supabase-client.js';
import type { LeadScore, LeadTemperature, ScoreSignal } from '../types/shared.js';

/**
 * Lead Scoring Engine backed by Supabase.
 * Invisible scoring system — customer never knows they're being scored.
 */
export class LeadScorer {
  private static instance: LeadScorer;

  static getInstance(): LeadScorer {
    if (!LeadScorer.instance) {
      LeadScorer.instance = new LeadScorer();
    }
    return LeadScorer.instance;
  }

  async getScore(conversationId: string): Promise<number> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_lead_scores')
      .select('score')
      .eq('conversation_id', conversationId)
      .single();
    return data?.score || 0;
  }

  async getLeadScore(conversationId: string): Promise<LeadScore | undefined> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_lead_scores')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (!data) return undefined;

    return {
      conversation_id: data.conversation_id,
      score: data.score,
      temperature: data.temperature as LeadTemperature,
      signals: data.signals as ScoreSignal[],
      updated_at: new Date(data.updated_at),
    };
  }

  /**
   * Temperature based on 0-100 scale.
   * hot: 70+, warm: 50-69, lukewarm: 30-49, cold: 0-29, not_fit: <0
   */
  getTemperature(score: number): LeadTemperature {
    if (score >= 70) return 'hot';
    if (score >= 50) return 'warm';
    if (score >= 30) return 'lukewarm';
    if (score >= 0) return 'cold';
    return 'not_fit';
  }

  async updateScore(conversationId: string, signal: Partial<ScoreSignal>): Promise<void> {
    const db = getSupabase();

    const fullSignal: ScoreSignal = {
      type: signal.type || 'positive',
      signal: signal.signal || 'unknown',
      points: signal.points || 0,
      detected_at: signal.detected_at || new Date(),
    };

    // Get existing score or create new
    const { data: existing } = await db
      .from('mandala_lead_scores')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (existing) {
      const signals = [...(existing.signals as ScoreSignal[]), fullSignal];
      const newScore = existing.score + fullSignal.points;
      const temperature = this.getTemperature(newScore);

      await db
        .from('mandala_lead_scores')
        .update({ score: newScore, temperature, signals, updated_at: new Date().toISOString() })
        .eq('conversation_id', conversationId);

      console.log(
        `[lead-scorer] ${conversationId}: ${fullSignal.points > 0 ? '+' : ''}${fullSignal.points} ` +
        `(${fullSignal.signal}) → total: ${newScore} [${temperature}]`
      );
    } else {
      const score = fullSignal.points;
      const temperature = this.getTemperature(score);

      await db.from('mandala_lead_scores').insert({
        conversation_id: conversationId,
        score,
        temperature,
        signals: [fullSignal],
      });

      console.log(
        `[lead-scorer] ${conversationId}: NEW ${fullSignal.points > 0 ? '+' : ''}${fullSignal.points} ` +
        `(${fullSignal.signal}) → total: ${score} [${temperature}]`
      );
    }
  }

  /**
   * Predefined scoring signals (0-100 scale).
   * These are used as fallback when shadow evaluator is unavailable.
   * Shadow evaluator provides its own score_delta per message.
   */
  static readonly SIGNALS = {
    // Positive
    HAS_ACTIVE_BUSINESS: { type: 'positive' as const, signal: 'has_active_business', points: 10 },
    HIGH_CHAT_VOLUME: { type: 'positive' as const, signal: 'high_chat_volume', points: 8 },
    HAS_ADMIN_OVERWHELMED: { type: 'positive' as const, signal: 'admin_overwhelmed', points: 12 },
    ASKED_PRICE: { type: 'positive' as const, signal: 'asked_price', points: 15 },
    REQUESTED_DEMO: { type: 'positive' as const, signal: 'requested_demo', points: 20 },
    MENTIONED_COMPETITOR: { type: 'positive' as const, signal: 'mentioned_competitor', points: 5 },
    FAST_RESPONSE: { type: 'positive' as const, signal: 'fast_response', points: 5 },
    SHARED_PAIN_DETAIL: { type: 'positive' as const, signal: 'shared_pain_detail', points: 10 },
    // Negative
    NO_BUSINESS: { type: 'negative' as const, signal: 'no_business', points: -25 },
    JUST_CURIOUS: { type: 'negative' as const, signal: 'just_curious', points: -8 },
    DELAYED_LATER: { type: 'negative' as const, signal: 'delayed_later', points: -10 },
    SLOW_RESPONSE: { type: 'negative' as const, signal: 'slow_response', points: -5 },
    VERY_LOW_BUDGET: { type: 'negative' as const, signal: 'very_low_budget', points: -15 },
    WANTS_FREE_ONLY: { type: 'negative' as const, signal: 'wants_free_only', points: -20 },
  };

  async listLeads(minScore?: number): Promise<LeadScore[]> {
    const db = getSupabase();
    let query = db
      .from('mandala_lead_scores')
      .select('*')
      .order('score', { ascending: false });

    if (minScore !== undefined) {
      query = query.gte('score', minScore);
    }

    const { data } = await query;
    return (data || []).map((row) => ({
      conversation_id: row.conversation_id,
      score: row.score,
      temperature: row.temperature as LeadTemperature,
      signals: row.signals as ScoreSignal[],
      updated_at: new Date(row.updated_at),
    }));
  }

  async listByTemperature(temperature: LeadTemperature): Promise<LeadScore[]> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_lead_scores')
      .select('*')
      .eq('temperature', temperature)
      .order('score', { ascending: false });

    return (data || []).map((row) => ({
      conversation_id: row.conversation_id,
      score: row.score,
      temperature: row.temperature as LeadTemperature,
      signals: row.signals as ScoreSignal[],
      updated_at: new Date(row.updated_at),
    }));
  }
}
