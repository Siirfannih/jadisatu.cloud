import { getModel } from './gemini-client.js';
import { ContextAssembler } from './context-assembler.js';
import type { AssembledContext, AIConfig, AIResponse } from '../types/shared.js';

export class AIEngine {
  private static instance: AIEngine;
  private assembler = ContextAssembler.getInstance();

  static getInstance(): AIEngine {
    if (!AIEngine.instance) {
      AIEngine.instance = new AIEngine();
    }
    return AIEngine.instance;
  }

  async generate(context: AssembledContext, aiConfig: AIConfig): Promise<AIResponse> {
    const systemPrompt = this.assembler.buildPrompt(context);
    const lastCustomerMessage = context.conversation_history
      .filter((m) => m.sender === 'customer' || m.sender === 'owner')
      .pop();

    if (!lastCustomerMessage) {
      return this.emptyResponse();
    }

    try {
      const model = getModel(aiConfig.conversation_model, {
        temperature: aiConfig.temperature,
        maxOutputTokens: aiConfig.max_tokens,
      });

      const userMessage = this.buildUserMessage(context, lastCustomerMessage.content);

      const result = await model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      });

      const text = result.response.text();
      return this.parseResponse(text);
    } catch (err) {
      console.error('[ai-engine] Error generating response:', err);
      return this.fallbackResponse();
    }
  }

  /**
   * Classify intent and score a message (uses cheap/fast model)
   */
  async classify(
    message: string,
    conversationContext: string,
    classifierModel: string
  ): Promise<{
    intent: string;
    buying_signal: number;
    is_target_market: boolean;
    objection?: string;
    recommended_action: 'continue' | 'close' | 'flag_owner';
  }> {
    try {
      const model = getModel(classifierModel, {
        temperature: 0,
        maxOutputTokens: 256,
      });

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah classifier. Analisa pesan customer berikut dan output JSON ONLY.
Context percakapan: ${conversationContext}`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Analisa pesan ini: "${message}"

Output JSON:
{
  "intent": "asking_price|asking_product|objection|interested|not_interested|greeting|other",
  "buying_signal": 0-5,
  "is_target_market": true/false,
  "objection": "price|quality|trust|timing|none",
  "recommended_action": "continue|close|flag_owner"
}`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        intent: 'other',
        buying_signal: 0,
        is_target_market: true,
        recommended_action: 'continue',
      };
    } catch {
      return {
        intent: 'other',
        buying_signal: 0,
        is_target_market: true,
        recommended_action: 'continue',
      };
    }
  }

  private buildUserMessage(context: AssembledContext, lastMessage: string): string {
    // Determine engagement context from lead score and phase
    const score = context.lead_score?.score ?? 0;
    const phase = context.phase_instruction || '';
    let engagementGuide = '';

    if (score >= 70) {
      engagementGuide = 'LEVEL: HOT — customer sangat tertarik. Boleh direct, bahas detail, pricing jika ditanya. Tetap conversational.';
    } else if (score >= 50) {
      engagementGuide = 'LEVEL: WARM — customer mulai terbuka. Boleh perkenalkan apa yang kamu kerjakan secara natural, hubungkan ke pain points mereka. Jangan push.';
    } else if (score >= 30) {
      engagementGuide = 'LEVEL: LUKEWARM — customer sedikit kenal. Fokus share pengalaman yang relatable. JANGAN sebut produk spesifik. Bangun trust.';
    } else {
      engagementGuide = 'LEVEL: COLD — belum kenal. Kamu TEMAN CURHAT, BUKAN sales. JANGAN sebut produk/layanan. Fokus 100% ke MEREKA — tanya, dengarkan, empati. Gali informasi secara natural.';
    }

    const parts = [
      `Customer mengirim: "${lastMessage}"`,
      '',
      engagementGuide,
      '',
      'INSTRUKSI:',
      '1. Reply seperti admin biasa di WhatsApp — casual, natural, seperti chat sama teman',
      '2. FOKUS ke customer dulu, bukan produk. Dengarkan, tanya, empati.',
      '3. Jumlah pesan HARUS BERVARIASI berdasarkan konteks:',
      '   - Jawaban singkat: 1 bubble saja ("oke kak" / "siap")',
      '   - Percakapan normal: 2-3 bubble',
      '   - Penjelasan detail: 4-6 bubble pendek',
      '   - JANGAN selalu kirim jumlah yang sama!',
      '4. Jika perlu pecah jadi beberapa pesan, pisahkan dengan |||',
      '5. Di akhir, tambahkan metadata: [META]{"intent":"...","confidence":0-1,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh output (variasi jumlah bubble):',
      '',
      'Contoh 1 bubble: oke kak siap ditunggu ya|||[META]{"intent":"acknowledge","confidence":0.9,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh 2 bubble: wah menarik nih kak bisnisnya|||btw selama ini kelola sosmednya sendiri atau ada tim?|||[META]{"intent":"qualifying","confidence":0.8,"score_delta":1,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh 5 bubble: harganya 1.5jt per bulan kak|||itu udah include setup awal|||terus dapet reporting bulanan juga|||jadi kakak tinggal terima report aja|||mau coba free audit dulu kak?|||[META]{"intent":"answer_price","confidence":0.9,"score_delta":2,"should_flag":false,"flag_reason":""}[/META]',
    ];

    return parts.join('\n');
  }

  private parseResponse(text: string): AIResponse {
    // Extract metadata
    const metaMatch = text.match(/\[META\](.*?)\[\/META\]/s);
    let internal = {
      intent: 'unknown',
      confidence: 0.5,
      score_update: undefined as any,
      should_flag_owner: false,
      flag_reason: undefined as string | undefined,
    };

    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        internal = {
          intent: meta.intent || 'unknown',
          confidence: meta.confidence || 0.5,
          score_update: meta.score_delta ? { type: meta.score_delta > 0 ? 'positive' : 'negative', signal: meta.intent, points: meta.score_delta, detected_at: new Date() } : undefined,
          should_flag_owner: meta.should_flag || false,
          flag_reason: meta.flag_reason || undefined,
        };
      } catch {
        // Failed to parse meta, use defaults
      }
    }

    // Extract messages (split by |||)
    const cleanText = text.replace(/\[META\].*?\[\/META\]/s, '').trim();
    const messages = cleanText
      .split('|||')
      .map((m) => m.trim())
      .filter(Boolean);

    // Generate natural delays between messages
    const delays = messages.map((_, i) =>
      i === 0 ? 0 : 1500 + Math.random() * 2500
    );

    return { messages, delays, internal };
  }

  private emptyResponse(): AIResponse {
    return {
      messages: [],
      delays: [],
      internal: {
        intent: 'none',
        confidence: 0,
        should_flag_owner: false,
      },
    };
  }

  private fallbackResponse(): AIResponse {
    return {
      messages: ['bentar ya kak, aku cek dulu'],
      delays: [0],
      internal: {
        intent: 'error_fallback',
        confidence: 0,
        should_flag_owner: true,
        flag_reason: 'AI engine error — need human intervention',
      },
    };
  }
}
