import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';
import type { Message } from '../types/shared.js';

/**
 * Customer memory shape matching the Supabase `mandala_customer_memory` table.
 */
export interface CustomerMemory {
  conversation_id: string;
  customer_number: string;
  business_name?: string;
  business_type?: string;
  business_channel?: string;
  chat_volume?: string;
  team_size?: string;
  pain_points: string[];
  communication_style?: Record<string, unknown>;
  negotiation_position?: Record<string, unknown>;
  objections_raised: string[];
  interests: string[];
  markdown_snapshot?: string;
  last_updated: Date;
}

/**
 * Memory Updater — Extracts and maintains dynamic customer memory.
 *
 * After each message exchange, updates the customer's profile in Supabase
 * with extracted business context, pain points, communication style, etc.
 * This memory is injected into context for personalized responses.
 */
export class MemoryUpdater {
  private static instance: MemoryUpdater;

  static getInstance(): MemoryUpdater {
    if (!MemoryUpdater.instance) {
      MemoryUpdater.instance = new MemoryUpdater();
    }
    return MemoryUpdater.instance;
  }

  /**
   * Get existing memory for a conversation.
   */
  async getMemory(conversationId: string): Promise<CustomerMemory | null> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_customer_memory')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (error || !data) return null;

    return {
      conversation_id: data.conversation_id,
      customer_number: data.customer_number,
      business_name: data.business_name,
      business_type: data.business_type,
      business_channel: data.business_channel,
      chat_volume: data.chat_volume,
      team_size: data.team_size,
      pain_points: data.pain_points || [],
      communication_style: data.communication_style || {},
      negotiation_position: data.negotiation_position || {},
      objections_raised: data.objections_raised || [],
      interests: data.interests || [],
      markdown_snapshot: data.markdown_snapshot,
      last_updated: new Date(data.updated_at),
    };
  }

  /**
   * Update memory after a message exchange.
   * Uses cheap/fast Gemini model to extract structured info from new messages.
   */
  async updateMemory(
    conversationId: string,
    _tenantId: string,
    customerNumber: string,
    recentMessages: Message[],
    existingMemory: CustomerMemory | null,
    classifierModel: string
  ): Promise<CustomerMemory> {
    const historyText = recentMessages
      .map((m) => `[${m.sender}] ${m.content}`)
      .join('\n');

    const existingJson = existingMemory
      ? JSON.stringify({
          business_name: existingMemory.business_name,
          business_type: existingMemory.business_type,
          business_channel: existingMemory.business_channel,
          chat_volume: existingMemory.chat_volume,
          team_size: existingMemory.team_size,
          pain_points: existingMemory.pain_points,
          communication_style: existingMemory.communication_style,
          negotiation_position: existingMemory.negotiation_position,
          objections_raised: existingMemory.objections_raised,
          interests: existingMemory.interests,
        })
      : '{}';

    try {
      const model = getModel(classifierModel, {
        temperature: 0,
        maxOutputTokens: 512,
      });

      const result = await model.generateContent({
        systemInstruction: `Extract customer information from the conversation. Merge with existing memory. Output JSON ONLY.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Existing memory: ${existingJson}

Recent messages:
${historyText}

Extract/update JSON (merge new info with existing, keep all valid facts):
{
  "business_name": "string or null",
  "business_type": "string or null (e.g. jasa sosmed, F&B, fashion)",
  "business_channel": "string or null (e.g. WhatsApp, Instagram, Marketplace)",
  "chat_volume": "string or null (e.g. 10-20/hari, ramai, sepi)",
  "team_size": "string or null (e.g. sendiri, 3 orang, tim kecil)",
  "pain_points": ["array of identified pain points"],
  "communication_style": {"tone": "formal|casual|mixed", "response_speed": "fast|normal|slow", "emoji_usage": "none|minimal|frequent"},
  "negotiation_position": {"stage": "exploring|interested|comparing|ready|resistant", "budget_indication": "string or null", "decision_maker": true/false},
  "objections_raised": ["array of objections/concerns mentioned"],
  "interests": ["array of topics/products they showed interest in"]
}`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const memory: CustomerMemory = {
          conversation_id: conversationId,
          customer_number: customerNumber,
          business_name: parsed.business_name || existingMemory?.business_name,
          business_type: parsed.business_type || existingMemory?.business_type,
          business_channel: parsed.business_channel || existingMemory?.business_channel,
          chat_volume: parsed.chat_volume || existingMemory?.chat_volume,
          team_size: parsed.team_size || existingMemory?.team_size,
          pain_points: parsed.pain_points || existingMemory?.pain_points || [],
          communication_style: parsed.communication_style || existingMemory?.communication_style || {},
          negotiation_position: parsed.negotiation_position || existingMemory?.negotiation_position || {},
          objections_raised: parsed.objections_raised || existingMemory?.objections_raised || [],
          interests: parsed.interests || existingMemory?.interests || [],
          last_updated: new Date(),
        };

        // Build markdown snapshot for context injection
        memory.markdown_snapshot = this.renderForContext(memory);

        await this.persistMemory(memory);
        console.log(`[memory-updater] Updated memory for ${conversationId}: ${memory.business_name || 'unknown'} (${memory.pain_points.length} pain points)`);
        return memory;
      }
    } catch (err) {
      console.error('[memory-updater] Error:', err);
    }

    // Return existing or empty
    return existingMemory || this.emptyMemory(conversationId, customerNumber);
  }

  /**
   * Render memory as markdown for context injection.
   */
  renderForContext(memory: CustomerMemory): string {
    const parts: string[] = ['# Customer Memory'];

    if (memory.business_name) {
      parts.push(`**Bisnis**: ${memory.business_name} (${memory.business_type || 'unknown'})`);
    }

    if (memory.business_channel) {
      parts.push(`**Channel**: ${memory.business_channel}`);
    }

    if (memory.chat_volume) {
      parts.push(`**Volume chat**: ${memory.chat_volume}`);
    }

    if (memory.team_size) {
      parts.push(`**Tim**: ${memory.team_size}`);
    }

    if (memory.pain_points.length > 0) {
      parts.push(`**Pain Points**:\n${memory.pain_points.map((p) => `- ${p}`).join('\n')}`);
    }

    const style = memory.communication_style as Record<string, string> | undefined;
    if (style?.tone) {
      parts.push(`**Gaya komunikasi**: ${style.tone}${style.emoji_usage ? `, emoji: ${style.emoji_usage}` : ''}`);
    }

    const position = memory.negotiation_position as Record<string, unknown> | undefined;
    if (position?.stage) {
      parts.push(`**Posisi negosiasi**: ${position.stage}`);
      if (position.budget_indication) {
        parts.push(`**Budget**: ${position.budget_indication}`);
      }
      parts.push(`**Decision maker**: ${position.decision_maker !== false ? 'Ya' : 'Bukan (perlu konsultasi)'}`);
    }

    if (memory.objections_raised.length > 0) {
      parts.push(`**Keberatan**:\n${memory.objections_raised.map((o) => `- ${o}`).join('\n')}`);
    }

    if (memory.interests.length > 0) {
      parts.push(`**Tertarik pada**:\n${memory.interests.map((i) => `- ${i}`).join('\n')}`);
    }

    return parts.join('\n');
  }

  private async persistMemory(memory: CustomerMemory): Promise<void> {
    const db = getSupabase();

    const row = {
      conversation_id: memory.conversation_id,
      customer_number: memory.customer_number,
      business_name: memory.business_name || null,
      business_type: memory.business_type || null,
      business_channel: memory.business_channel || null,
      chat_volume: memory.chat_volume || null,
      team_size: memory.team_size || null,
      pain_points: memory.pain_points,
      communication_style: memory.communication_style || {},
      negotiation_position: memory.negotiation_position || {},
      objections_raised: memory.objections_raised,
      interests: memory.interests,
      markdown_snapshot: memory.markdown_snapshot || null,
    };

    const { error } = await db.from('mandala_customer_memory').upsert(row, { onConflict: 'conversation_id' });
    if (error) {
      console.error(`[memory-updater] Supabase upsert failed:`, error.message);
    }
  }

  private emptyMemory(conversationId: string, customerNumber: string): CustomerMemory {
    return {
      conversation_id: conversationId,
      customer_number: customerNumber,
      pain_points: [],
      communication_style: {},
      negotiation_position: {},
      objections_raised: [],
      interests: [],
      last_updated: new Date(),
    };
  }
}
