import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';
import type { Message } from '../types/shared.js';
import type { ConversationPhase, EvaluatorResult, CustomerMemory } from '../state-machine/types.js';

/**
 * Shadow Evaluator — Runs a cheap Gemini Flash call BEFORE main response.
 *
 * Analyzes each incoming message for:
 * - Intent classification
 * - Buying signal strength (0-10)
 * - Objections / resistance patterns
 * - Recommended action for phase controller
 * - Score delta (how much to adjust lead score)
 */
export class ShadowEvaluator {
  private static instance: ShadowEvaluator;

  static getInstance(): ShadowEvaluator {
    if (!ShadowEvaluator.instance) {
      ShadowEvaluator.instance = new ShadowEvaluator();
    }
    return ShadowEvaluator.instance;
  }

  async evaluate(
    message: string,
    recentMessages: Message[],
    currentPhase: ConversationPhase,
    currentScore: number,
    memory: CustomerMemory | null,
    classifierModel: string
  ): Promise<EvaluatorResult> {
    const historyContext = recentMessages
      .map((m) => `[${m.sender}] ${m.content}`)
      .join('\n');

    const memoryContext = memory
      ? `Business: ${memory.business_name || 'unknown'} (${memory.business_type || 'unknown'})
Pain points: ${memory.pain_points.join(', ') || 'none identified'}
Style: ${memory.communication_style}
Position: ${memory.negotiation_position}
Key facts: ${memory.key_facts.join(', ') || 'none'}`
      : 'No prior memory.';

    try {
      const model = getModel(classifierModel, {
        temperature: 0,
        maxOutputTokens: 512,
      });

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah evaluator percakapan sales B2B. Analisa pesan customer dan output JSON ONLY.

Current phase: ${currentPhase}
Current score: ${currentScore}/100
Customer memory: ${memoryContext}

Recent messages:
${historyContext}`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Analisa pesan customer ini: "${message}"

Output JSON (ONLY JSON, no other text):
{
  "intent": "greeting|asking_info|sharing_pain|asking_price|comparing|interested|objection|stalling|rejection|gratitude|other",
  "buying_signal": 0-10,
  "objection": "price|quality|trust|timing|competitor|none",
  "resistance_type": "time_stalling|value_mismatch|silence|explicit_rejection|competitor_mention|trust_issue|null",
  "recommended_action": "continue|advance_phase|rescue|flag_owner|close",
  "score_delta": -30 to +20,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Scoring guide:
- greeting/basa-basi: +2 to +5
- sharing pain/problem: +8 to +15
- asking price: +10 to +15
- requesting demo: +15 to +20
- showing interest: +5 to +10
- mild stalling ("nanti aja"): -5 to -10
- price objection after seeing price: -10 to -15
- explicit rejection: -20 to -30
- comparing competitors (could be positive): +3 to +5`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const evalResult: EvaluatorResult = {
          intent: parsed.intent || 'other',
          buying_signal: Math.min(10, Math.max(0, parsed.buying_signal || 0)),
          objection: parsed.objection === 'none' ? null : (parsed.objection || null),
          resistance_type: parsed.resistance_type === 'null' || !parsed.resistance_type ? null : parsed.resistance_type,
          recommended_action: parsed.recommended_action || 'continue',
          score_delta: Math.min(20, Math.max(-30, parsed.score_delta || 0)),
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
          reasoning: parsed.reasoning || '',
        };

        // Persist to evaluator log
        await this.persistLog(message, evalResult, currentPhase, currentScore);

        return evalResult;
      }

      return this.defaultResult();
    } catch (err) {
      console.error('[shadow-evaluator] Error:', err);
      return this.defaultResult();
    }
  }

  private async persistLog(
    message: string,
    result: EvaluatorResult,
    phase: ConversationPhase,
    score: number
  ): Promise<void> {
    try {
      const db = getSupabase();
      await db.from('mandala_evaluator_log').insert({
        message_content: message,
        phase,
        score_before: score,
        score_delta: result.score_delta,
        intent: result.intent,
        buying_signal: result.buying_signal,
        objection: result.objection,
        resistance_type: result.resistance_type,
        recommended_action: result.recommended_action,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });
    } catch (err) {
      console.error('[shadow-evaluator] Failed to persist log:', err);
    }
  }

  private defaultResult(): EvaluatorResult {
    return {
      intent: 'other',
      buying_signal: 0,
      objection: null,
      resistance_type: null,
      recommended_action: 'continue',
      score_delta: 0,
      confidence: 0,
      reasoning: 'Evaluator failed — using defaults',
    };
  }
}
