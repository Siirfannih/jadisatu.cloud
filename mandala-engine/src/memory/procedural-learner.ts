/**
 * Procedural Learner — Learns what works from conversation outcomes.
 *
 * After a conversation is resolved (positive or negative outcome),
 * extracts procedural knowledge:
 * - "Approach X worked for guest complaint type Y"
 * - "Tone Z gets better response rate for outreach"
 * - "Avoid doing A when customer mentions B"
 *
 * Stored in Pinecone as 'procedural' type for future recall.
 */
import { getModel } from '../ai/gemini-client.js';
import { SemanticStore } from './semantic-store.js';
import type { Message } from '../types/shared.js';

export type ConversationOutcome = 'positive' | 'negative' | 'neutral';

export interface ProceduralInsight {
  insight: string;
  category: 'approach' | 'tone' | 'timing' | 'topic' | 'avoidance';
  confidence: number;
  context: string;
}

export class ProceduralLearner {
  private static instance: ProceduralLearner;
  private semanticStore = SemanticStore.getInstance();

  static getInstance(): ProceduralLearner {
    if (!ProceduralLearner.instance) {
      ProceduralLearner.instance = new ProceduralLearner();
    }
    return ProceduralLearner.instance;
  }

  /**
   * Extract procedural insights from a completed conversation.
   */
  async learn(
    tenantId: string,
    conversationId: string,
    messages: Message[],
    outcome: ConversationOutcome,
    classifierModel = 'gemini-2.0-flash'
  ): Promise<ProceduralInsight[]> {
    if (messages.length < 4) return []; // Need enough context to learn from

    try {
      const model = getModel(classifierModel, {
        temperature: 0.2,
        maxOutputTokens: 1024,
      });

      const conversationText = messages
        .slice(-20) // Last 20 messages for context
        .map(m => `[${m.sender}] ${m.content}`)
        .join('\n');

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah learning engine untuk AI customer service hospitality.
Analisis percakapan yang sudah selesai dan extract PELAJARAN yang bisa digunakan untuk percakapan lain.

Outcome percakapan: ${outcome}

Jika outcome POSITIVE → extract apa yang berhasil (untuk diulangi)
Jika outcome NEGATIVE → extract apa yang gagal (untuk dihindari)
Jika outcome NEUTRAL → extract observasi yang mungkin berguna

FOKUS pada pelajaran yang GENERALIZABLE — bukan spesifik ke satu customer.
Contoh BAGUS: "Menawarkan room upgrade gratis sebagai kompensasi complaint AC berhasil
meningkatkan satisfaction"
Contoh BURUK: "Pak Budi suka kamar lantai 3" (ini episodic, bukan procedural)

Output JSON ONLY.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Percakapan (outcome: ${outcome}):

${conversationText}

Output JSON:
{
  "insights": [
    {
      "insight": "pelajaran yang bisa di-generalize",
      "category": "approach|tone|timing|topic|avoidance",
      "confidence": 0.0-1.0,
      "context": "konteks singkat kapan insight ini berlaku"
    }
  ]
}`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const insights: ProceduralInsight[] = (parsed.insights || [])
        .filter((i: Record<string, unknown>) => (i.confidence as number) >= 0.5)
        .map((i: Record<string, unknown>) => ({
          insight: i.insight as string,
          category: (i.category as ProceduralInsight['category']) || 'approach',
          confidence: (i.confidence as number) || 0.5,
          context: (i.context as string) || '',
        }));

      if (insights.length === 0) return [];

      // Store each insight in Pinecone
      for (const insight of insights) {
        const embeddingText = `[${insight.category}] ${insight.insight} (context: ${insight.context})`;
        await this.semanticStore.store(tenantId, embeddingText, 'procedural', {
          conversation_id: conversationId,
          source: `outcome:${outcome}`,
        });
      }

      console.log(`[procedural-learner] Extracted ${insights.length} insights from conversation ${conversationId} (outcome: ${outcome})`);
      return insights;

    } catch (err) {
      console.error('[procedural-learner] Learning failed:', err);
      return [];
    }
  }
}
