/**
 * Post-Conversation Pipeline — Triggered when a conversation closes.
 *
 * Steps:
 * 1. Summarize conversation (Gemini Flash)
 * 2. Extract episodes (promises, preferences, complaints)
 * 3. Evaluate outcome (positive/negative/neutral)
 * 4. If sufficient messages → extract procedural learnings
 * 5. Store conversation summary as semantic memory
 *
 * Trigger: conversation status → 'closed' or after 2h inactivity.
 */
import { getModel } from '../ai/gemini-client.js';
import { EpisodeExtractor } from './episode-extractor.js';
import { ProceduralLearner, type ConversationOutcome } from './procedural-learner.js';
import { SemanticStore } from './semantic-store.js';
import type { Conversation, Message } from '../types/shared.js';

export class PostConversationPipeline {
  private static instance: PostConversationPipeline;
  private episodeExtractor = EpisodeExtractor.getInstance();
  private proceduralLearner = ProceduralLearner.getInstance();
  private semanticStore = SemanticStore.getInstance();

  static getInstance(): PostConversationPipeline {
    if (!PostConversationPipeline.instance) {
      PostConversationPipeline.instance = new PostConversationPipeline();
    }
    return PostConversationPipeline.instance;
  }

  /**
   * Run the full post-conversation pipeline.
   */
  async process(conversation: Conversation): Promise<{
    summary: string;
    episodeCount: number;
    outcome: ConversationOutcome;
    insightCount: number;
  }> {
    const tenantId = conversation.tenant_id;
    const customerNumber = conversation.customer_number;
    const messages = conversation.messages;

    console.log(`[post-pipeline] Processing conversation ${conversation.id} (${messages.length} messages)`);

    if (messages.length < 3) {
      console.log(`[post-pipeline] Skipping — too few messages (${messages.length})`);
      return { summary: '', episodeCount: 0, outcome: 'neutral', insightCount: 0 };
    }

    // Step 1: Summarize conversation
    const summary = await this.summarize(messages);

    // Step 2: Extract episodes
    const episodes = await this.episodeExtractor.extract(
      tenantId,
      customerNumber,
      conversation.id,
      messages
    );

    // Step 3: Evaluate outcome
    const outcome = await this.evaluateOutcome(messages);

    // Step 4: Procedural learning (only for conversations with enough depth)
    let insightCount = 0;
    if (messages.length >= 6) {
      const insights = await this.proceduralLearner.learn(
        tenantId,
        conversation.id,
        messages,
        outcome
      );
      insightCount = insights.length;
    }

    // Step 5: Store conversation summary as semantic memory
    if (summary) {
      await this.semanticStore.store(tenantId, summary, 'semantic', {
        customer_number: customerNumber,
        conversation_id: conversation.id,
        source: 'conversation_summary',
      });
    }

    console.log(`[post-pipeline] Done: summary=${!!summary}, episodes=${episodes.length}, outcome=${outcome}, insights=${insightCount}`);

    return {
      summary,
      episodeCount: episodes.length,
      outcome,
      insightCount,
    };
  }

  /**
   * Summarize a conversation into a concise text.
   */
  private async summarize(messages: Message[]): Promise<string> {
    try {
      const model = getModel('gemini-2.0-flash', {
        temperature: 0.1,
        maxOutputTokens: 512,
      });

      const conversationText = messages
        .map(m => `[${m.sender}] ${m.content}`)
        .join('\n');

      const result = await model.generateContent({
        systemInstruction: `Buat ringkasan singkat percakapan customer service hospitality ini.
Fokus pada: topik utama, hasil/outcome, dan hal penting yang perlu diingat.
Output dalam 2-4 kalimat Bahasa Indonesia. Plain text only.`,
        contents: [{
          role: 'user',
          parts: [{ text: conversationText }],
        }],
      });

      return result.response.text().trim();
    } catch (err) {
      console.error('[post-pipeline] Summarization failed:', err);
      return '';
    }
  }

  /**
   * Evaluate the outcome of a conversation.
   */
  private async evaluateOutcome(messages: Message[]): Promise<ConversationOutcome> {
    try {
      const model = getModel('gemini-2.0-flash', {
        temperature: 0,
        maxOutputTokens: 128,
      });

      const lastMessages = messages.slice(-10)
        .map(m => `[${m.sender}] ${m.content}`)
        .join('\n');

      const result = await model.generateContent({
        systemInstruction: `Evaluasi outcome percakapan CS ini. Output HANYA satu kata:
- "positive" jika customer puas/masalah terselesaikan/deal terjadi
- "negative" jika customer kecewa/complaint tidak terselesaikan/explicit rejection
- "neutral" jika inconclusive/masih berlanjut/conversation ended naturally`,
        contents: [{
          role: 'user',
          parts: [{ text: lastMessages }],
        }],
      });

      const text = result.response.text().trim().toLowerCase();
      if (text.includes('positive')) return 'positive';
      if (text.includes('negative')) return 'negative';
      return 'neutral';
    } catch {
      return 'neutral';
    }
  }
}
