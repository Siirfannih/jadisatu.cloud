import { getModel } from '../ai/gemini-client.js';
import { getSupabase } from '../memory/supabase-client.js';
import type { Message } from '../types/shared.js';
import type { CustomerMemory } from '../state-machine/types.js';

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
    const { data } = await db
      .from('mandala_customer_memory')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (!data) return null;

    return {
      conversation_id: data.conversation_id,
      tenant_id: data.tenant_id,
      customer_number: data.customer_number,
      business_name: data.business_name,
      business_type: data.business_type,
      pain_points: data.pain_points || [],
      communication_style: data.communication_style || 'casual',
      budget_indication: data.budget_indication,
      decision_maker: data.decision_maker ?? true,
      negotiation_position: data.negotiation_position || 'exploring',
      key_facts: data.key_facts || [],
      last_updated: new Date(data.updated_at),
    };
  }

  /**
   * Update memory after a message exchange.
   * Uses cheap/fast Gemini model to extract structured info from new messages.
   */
  async updateMemory(
    conversationId: string,
    tenantId: string,
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
          pain_points: existingMemory.pain_points,
          communication_style: existingMemory.communication_style,
          budget_indication: existingMemory.budget_indication,
          decision_maker: existingMemory.decision_maker,
          negotiation_position: existingMemory.negotiation_position,
          key_facts: existingMemory.key_facts,
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

Extract/update JSON (merge new info with existing, keep all existing facts that are still valid):
{
  "business_name": "string or null",
  "business_type": "string or null",
  "pain_points": ["array of identified pain points"],
  "communication_style": "formal|casual|mixed",
  "budget_indication": "string or null",
  "decision_maker": true/false,
  "negotiation_position": "exploring|interested|comparing|ready|resistant",
  "key_facts": ["important facts about this customer"]
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
          tenant_id: tenantId,
          customer_number: customerNumber,
          business_name: parsed.business_name || existingMemory?.business_name,
          business_type: parsed.business_type || existingMemory?.business_type,
          pain_points: parsed.pain_points || existingMemory?.pain_points || [],
          communication_style: parsed.communication_style || existingMemory?.communication_style || 'casual',
          budget_indication: parsed.budget_indication || existingMemory?.budget_indication,
          decision_maker: parsed.decision_maker ?? existingMemory?.decision_maker ?? true,
          negotiation_position: parsed.negotiation_position || existingMemory?.negotiation_position || 'exploring',
          key_facts: parsed.key_facts || existingMemory?.key_facts || [],
          last_updated: new Date(),
        };

        await this.persistMemory(memory);
        return memory;
      }
    } catch (err) {
      console.error('[memory-updater] Error:', err);
    }

    // Return existing or empty
    return existingMemory || this.emptyMemory(conversationId, tenantId, customerNumber);
  }

  /**
   * Render memory as markdown for context injection.
   */
  renderForContext(memory: CustomerMemory): string {
    const parts: string[] = ['# Customer Memory'];

    if (memory.business_name) {
      parts.push(`**Bisnis**: ${memory.business_name} (${memory.business_type || 'unknown'})`);
    }

    if (memory.pain_points.length > 0) {
      parts.push(`**Pain Points**:\n${memory.pain_points.map((p) => `- ${p}`).join('\n')}`);
    }

    parts.push(`**Gaya komunikasi**: ${memory.communication_style}`);
    parts.push(`**Posisi negosiasi**: ${memory.negotiation_position}`);

    if (memory.budget_indication) {
      parts.push(`**Budget**: ${memory.budget_indication}`);
    }

    parts.push(`**Decision maker**: ${memory.decision_maker ? 'Ya' : 'Bukan (perlu konsultasi)'}`);

    if (memory.key_facts.length > 0) {
      parts.push(`**Fakta penting**:\n${memory.key_facts.map((f) => `- ${f}`).join('\n')}`);
    }

    return parts.join('\n');
  }

  private async persistMemory(memory: CustomerMemory): Promise<void> {
    const db = getSupabase();

    const row = {
      conversation_id: memory.conversation_id,
      tenant_id: memory.tenant_id,
      customer_number: memory.customer_number,
      business_name: memory.business_name,
      business_type: memory.business_type,
      pain_points: memory.pain_points,
      communication_style: memory.communication_style,
      budget_indication: memory.budget_indication,
      decision_maker: memory.decision_maker,
      negotiation_position: memory.negotiation_position,
      key_facts: memory.key_facts,
    };

    await db.from('mandala_customer_memory').upsert(row, { onConflict: 'conversation_id' });
  }

  private emptyMemory(conversationId: string, tenantId: string, customerNumber: string): CustomerMemory {
    return {
      conversation_id: conversationId,
      tenant_id: tenantId,
      customer_number: customerNumber,
      pain_points: [],
      communication_style: 'casual',
      decision_maker: true,
      negotiation_position: 'exploring',
      key_facts: [],
      last_updated: new Date(),
    };
  }
}
