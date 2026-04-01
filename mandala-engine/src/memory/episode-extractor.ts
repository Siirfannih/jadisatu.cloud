/**
 * Episode Extractor — Extracts key facts/events from conversations.
 *
 * Uses Gemini Flash (cheap) to identify:
 * - Promises made to the customer
 * - Customer preferences
 * - Complaints and resolutions
 * - Booking details
 * - Key facts about the customer
 *
 * Episodes are stored in both Supabase (mandala_episodes) and Pinecone (for recall).
 */
import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from './supabase-client.js';
import { SemanticStore } from './semantic-store.js';
import type { Message } from '../types/shared.js';

export interface Episode {
  episode_type: 'promise' | 'preference' | 'complaint' | 'resolution' | 'booking' | 'feedback' | 'request' | 'fact';
  content: string;
  extracted_data: Record<string, unknown>;
  happened_at: string;
}

export class EpisodeExtractor {
  private static instance: EpisodeExtractor;
  private semanticStore = SemanticStore.getInstance();

  static getInstance(): EpisodeExtractor {
    if (!EpisodeExtractor.instance) {
      EpisodeExtractor.instance = new EpisodeExtractor();
    }
    return EpisodeExtractor.instance;
  }

  /**
   * Extract episodes from a set of conversation messages.
   * Returns the extracted episodes (also persists to DB + Pinecone).
   */
  async extract(
    tenantId: string,
    customerNumber: string,
    conversationId: string,
    messages: Message[],
    classifierModel = 'gemini-2.0-flash'
  ): Promise<Episode[]> {
    if (messages.length < 2) return [];

    try {
      const model = getModel(classifierModel, {
        temperature: 0.1,
        maxOutputTokens: 2048,
      });

      const conversationText = messages
        .map(m => `[${m.sender}] ${m.content}`)
        .join('\n');

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah memory extractor untuk AI customer service hospitality.
Tugasmu: extract fakta penting dari percakapan.

EXTRACT HANYA yang benar-benar penting dan factual:
- promise: janji yang dibuat ke customer (contoh: "akan follow up besok")
- preference: preferensi customer (contoh: "suka kamar dengan view laut")
- complaint: keluhan customer (contoh: "AC kamar terlalu dingin")
- resolution: penyelesaian keluhan (contoh: "sudah pindah kamar")
- booking: info booking (contoh: "check-in 5 April, 2 malam")
- feedback: feedback customer (contoh: "puas dengan pelayanan")
- request: permintaan spesifik (contoh: "minta extra bed")
- fact: fakta penting tentang customer (contoh: "pemilik cafe di Bali")

Output JSON ONLY. Jika tidak ada episode penting, output empty array.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Extract episodes dari percakapan ini:

${conversationText}

Output JSON:
{
  "episodes": [
    {
      "episode_type": "type",
      "content": "deskripsi singkat episode",
      "extracted_data": { "key": "value" },
      "happened_at": "ISO timestamp or 'during_conversation'"
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
      const episodes: Episode[] = (parsed.episodes || []).map((e: Record<string, unknown>) => ({
        episode_type: e.episode_type as Episode['episode_type'] || 'fact',
        content: e.content as string || '',
        extracted_data: (e.extracted_data as Record<string, unknown>) || {},
        happened_at: (e.happened_at as string) || new Date().toISOString(),
      }));

      if (episodes.length === 0) return [];

      // Persist to Supabase and Pinecone
      await this.persist(tenantId, customerNumber, conversationId, episodes);

      return episodes;

    } catch (err) {
      console.error('[episode-extractor] Extraction failed:', err);
      return [];
    }
  }

  /**
   * Persist episodes to Supabase + Pinecone.
   */
  private async persist(
    tenantId: string,
    customerNumber: string,
    conversationId: string,
    episodes: Episode[]
  ): Promise<void> {
    const db = getSupabase();

    for (const episode of episodes) {
      // Store in Supabase
      try {
        const happenedAt = episode.happened_at === 'during_conversation'
          ? new Date().toISOString()
          : episode.happened_at;

        const { data } = await db
          .from('mandala_episodes')
          .insert({
            tenant_id: tenantId,
            customer_number: customerNumber,
            conversation_id: conversationId,
            episode_type: episode.episode_type,
            content: episode.content,
            extracted_data: episode.extracted_data,
            happened_at: happenedAt,
          })
          .select('id')
          .single();

        // Store in Pinecone for semantic recall
        const embeddingText = `[${episode.episode_type}] ${episode.content}`;
        const vectorId = await this.semanticStore.store(tenantId, embeddingText, 'episodic', {
          customer_number: customerNumber,
          conversation_id: conversationId,
          episode_type: episode.episode_type,
        });

        // Update Supabase row with the Pinecone vector ID
        if (data?.id) {
          await db
            .from('mandala_episodes')
            .update({ embedding_id: vectorId })
            .eq('id', data.id);
        }
      } catch (err) {
        console.error(`[episode-extractor] Failed to persist episode:`, err);
        // Continue with other episodes
      }
    }

    console.log(`[episode-extractor] Persisted ${episodes.length} episodes for ${customerNumber} (tenant: ${tenantId})`);
  }
}
