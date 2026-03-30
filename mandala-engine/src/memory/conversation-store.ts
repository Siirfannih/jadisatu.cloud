import { getSupabase } from './supabase-client.js';
import type { Conversation, Message } from '../types/shared.js';

/**
 * Conversation store backed by Supabase.
 * Replaces the previous in-memory Map implementation.
 */
export class ConversationStore {
  private static instance: ConversationStore;

  static getInstance(): ConversationStore {
    if (!ConversationStore.instance) {
      ConversationStore.instance = new ConversationStore();
    }
    return ConversationStore.instance;
  }

  async get(id: string): Promise<Conversation | undefined> {
    const db = getSupabase();
    const { data: conv } = await db
      .from('mandala_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (!conv) return undefined;

    const messages = await this.getMessages(id);
    return this.toConversation(conv, messages);
  }

  async set(conversation: Conversation): Promise<void> {
    const db = getSupabase();
    const { messages, ...convData } = this.toRow(conversation);

    await db.from('mandala_conversations').upsert(convData);

    if (conversation.messages.length > 0) {
      const msgRows = conversation.messages.map((m) => ({
        id: m.id,
        conversation_id: conversation.id,
        tenant_id: conversation.tenant_id,
        direction: m.direction,
        sender: m.sender,
        sender_number: m.sender_number,
        content: m.content,
        metadata: m.metadata || {},
        created_at: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));
      await db.from('mandala_messages').upsert(msgRows, { onConflict: 'id' });
    }
  }

  async update(conversation: Conversation): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_conversations')
      .update({
        status: conversation.status,
        current_handler: conversation.current_handler,
        lead_score: conversation.lead_score,
        phase: conversation.phase || 'kenalan',
        last_message_at: conversation.last_message_at instanceof Date
          ? conversation.last_message_at.toISOString()
          : conversation.last_message_at,
        last_owner_reply_at: conversation.last_owner_reply_at
          ? (conversation.last_owner_reply_at instanceof Date
            ? conversation.last_owner_reply_at.toISOString()
            : conversation.last_owner_reply_at)
          : null,
        metadata: conversation.metadata || {},
      })
      .eq('id', conversation.id);
  }

  async addMessage(conversationId: string, message: Message): Promise<string> {
    const db = getSupabase();
    const row = {
      id: message.id,
      conversation_id: conversationId,
      tenant_id: message.tenant_id,
      direction: message.direction,
      sender: message.sender,
      sender_number: message.sender_number,
      content: message.content,
      metadata: message.metadata || {},
      created_at: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
    };

    await db.from('mandala_messages').insert(row);

    // Update conversation last_message_at
    await db
      .from('mandala_conversations')
      .update({ last_message_at: row.created_at })
      .eq('id', conversationId);

    return message.id;
  }

  async getMessages(conversationId: string, limit = 30): Promise<Message[]> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    return (data || []).map(this.rowToMessage);
  }

  async getRecentMessages(conversationId: string, count = 5): Promise<Message[]> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(count);

    return (data || []).reverse().map(this.rowToMessage);
  }

  async getByCustomer(tenantId: string, customerNumber: string): Promise<Conversation | undefined> {
    const db = getSupabase();
    const { data: conv } = await db
      .from('mandala_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_number', customerNumber)
      .eq('status', 'active')
      .single();

    if (!conv) return undefined;

    const messages = await this.getMessages(conv.id);
    return this.toConversation(conv, messages);
  }

  /**
   * Find a recent outreach-only conversation (only outgoing messages, no incoming).
   * Used as fallback when a LID message arrives and we can't resolve to phone number.
   */
  async findRecentOutreachOnly(tenantId: string): Promise<Conversation | undefined> {
    const db = getSupabase();
    // Find active conversations created in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: convs } = await db
      .from('mandala_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('customer_number', 'like', '%@lid')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!convs || convs.length === 0) return undefined;

    // Check each conversation to find one with only outgoing messages (outreach, no reply yet)
    for (const conv of convs) {
      const { data: msgs } = await db
        .from('mandala_messages')
        .select('direction')
        .eq('conversation_id', conv.id)
        .limit(20);

      if (!msgs || msgs.length === 0) continue;

      const hasIncoming = msgs.some((m: any) => m.direction === 'incoming');
      if (!hasIncoming) {
        const messages = await this.getMessages(conv.id);
        return this.toConversation(conv, messages);
      }
    }

    return undefined;
  }

  /**
   * Update the customer_number on an existing conversation (e.g. after LID resolution).
   */
  async updateCustomerNumber(conversationId: string, newNumber: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_conversations')
      .update({ customer_number: newNumber })
      .eq('id', conversationId);

    // Also update messages sender_number for outgoing messages
    await db
      .from('mandala_messages')
      .update({ sender_number: newNumber })
      .eq('conversation_id', conversationId)
      .eq('direction', 'incoming');
  }

  async listByTenant(tenantId: string, status?: string): Promise<Conversation[]> {
    const db = getSupabase();
    let query = db
      .from('mandala_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;
    // Return without messages for list view (lightweight)
    return (data || []).map((row) => this.toConversation(row, []));
  }

  async listActive(): Promise<Conversation[]> {
    const db = getSupabase();
    const { data } = await db
      .from('mandala_conversations')
      .select('*')
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });

    return (data || []).map((row) => this.toConversation(row, []));
  }

  async updatePhase(conversationId: string, phase: string): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_conversations')
      .update({ phase })
      .eq('id', conversationId);
  }

  async updateScore(conversationId: string, score: number): Promise<void> {
    const db = getSupabase();
    await db
      .from('mandala_conversations')
      .update({ lead_score: score })
      .eq('id', conversationId);
  }

  async delete(conversationId: string): Promise<void> {
    const db = getSupabase();
    // Delete in order: messages → lead scores → customer memory → conversation
    await db.from('mandala_messages').delete().eq('conversation_id', conversationId);
    await db.from('mandala_lead_scores').delete().eq('conversation_id', conversationId);
    await db.from('mandala_customer_memory').delete().eq('conversation_id', conversationId);
    await db.from('mandala_conversations').delete().eq('id', conversationId);
  }

  async reset(conversationId: string): Promise<void> {
    const db = getSupabase();
    // Delete messages and scoring, reset conversation to kenalan/0
    await db.from('mandala_messages').delete().eq('conversation_id', conversationId);
    await db.from('mandala_lead_scores').delete().eq('conversation_id', conversationId);
    await db.from('mandala_customer_memory').delete().eq('conversation_id', conversationId);
    await db.from('mandala_conversations').update({
      phase: 'kenalan',
      lead_score: 0,
      current_handler: 'unassigned',
      status: 'active',
    }).eq('id', conversationId);
  }

  async stats(tenantId: string): Promise<{
    total: number;
    active: number;
    mandala_handling: number;
    owner_handling: number;
    avg_score: number;
  }> {
    const db = getSupabase();
    const { data: all } = await db
      .from('mandala_conversations')
      .select('status, current_handler, lead_score')
      .eq('tenant_id', tenantId);

    const convs = all || [];
    const active = convs.filter((c) => c.status === 'active');
    const scores = convs.map((c) => c.lead_score).filter((s: number) => s > 0);

    return {
      total: convs.length,
      active: active.length,
      mandala_handling: active.filter((c) => c.current_handler === 'mandala').length,
      owner_handling: active.filter((c) => c.current_handler === 'owner').length,
      avg_score: scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
    };
  }

  // Helpers

  private toConversation(row: any, messages: Message[]): Conversation {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      customer_number: row.customer_number,
      customer_name: row.customer_name,
      status: row.status,
      current_handler: row.current_handler,
      mode: row.mode,
      phase: row.phase || 'kenalan',
      lead_score: row.lead_score,
      messages,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_message_at: new Date(row.last_message_at),
      last_owner_reply_at: row.last_owner_reply_at ? new Date(row.last_owner_reply_at) : undefined,
      metadata: row.metadata,
    };
  }

  private toRow(conversation: Conversation) {
    return {
      id: conversation.id,
      tenant_id: conversation.tenant_id,
      customer_number: conversation.customer_number,
      customer_name: conversation.customer_name,
      status: conversation.status,
      current_handler: conversation.current_handler,
      mode: conversation.mode,
      lead_score: conversation.lead_score,
      phase: conversation.phase || 'kenalan',
      last_message_at: conversation.last_message_at instanceof Date
        ? conversation.last_message_at.toISOString()
        : conversation.last_message_at,
      last_owner_reply_at: conversation.last_owner_reply_at
        ? (conversation.last_owner_reply_at instanceof Date
          ? conversation.last_owner_reply_at.toISOString()
          : conversation.last_owner_reply_at)
        : null,
      metadata: conversation.metadata || {},
      messages: conversation.messages,
    };
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      tenant_id: row.tenant_id,
      direction: row.direction,
      sender: row.sender,
      sender_number: row.sender_number,
      content: row.content,
      timestamp: new Date(row.created_at),
      metadata: row.metadata,
    };
  }
}
