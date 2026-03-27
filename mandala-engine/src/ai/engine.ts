import { getModel } from './gemini-client.js';
import { ContextAssembler } from './context-assembler.js';
import type { AssembledContext, AIConfig, AIResponse } from '../types/shared.js';
import type { MandalaTask } from '../tasks/types.js';

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
    const systemPrompt = await this.assembler.buildPrompt(context);
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
   * Generate a response for a task execution (outreach, follow_up, rescue, qualification).
   * Unlike generate(), this does NOT require a customer message — Mandala is initiating.
   */
  async generateForTask(context: AssembledContext, aiConfig: AIConfig, task: MandalaTask): Promise<AIResponse> {
    const systemPrompt = await this.assembler.buildPrompt(context);

    try {
      const model = getModel(aiConfig.conversation_model, {
        temperature: aiConfig.temperature,
        maxOutputTokens: aiConfig.max_tokens,
      });

      const userMessage = this.buildTaskUserMessage(task, context);

      const result = await model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      });

      const text = result.response.text();
      return this.parseResponse(text);
    } catch (err) {
      console.error('[ai-engine] Error generating task response:', err);
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

  private buildTaskUserMessage(task: MandalaTask, context: AssembledContext): string {
    const hasHistory = context.conversation_history.length > 0;
    const targetName = task.target.customer_name || 'prospek baru';
    const targetNumber = task.target.customer_number;

    const parts: string[] = [];

    // Task briefing
    parts.push(`TASK DARI OWNER:`);
    parts.push(`Tipe: ${task.type}`);
    parts.push(`Target: ${targetName} (${targetNumber})`);
    parts.push(`Objective: ${task.objective}`);
    if (task.context) {
      parts.push(`Context tambahan: ${task.context}`);
    }

    // Conversation status
    if (hasHistory) {
      const lastMsg = context.conversation_history[context.conversation_history.length - 1];
      parts.push('');
      parts.push(`Conversation sudah ada — pesan terakhir dari ${lastMsg.sender}: "${lastMsg.content}"`);
    } else {
      parts.push('');
      parts.push('Ini kontak PERTAMA ke prospek ini. Belum ada percakapan sebelumnya.');
    }

    // Instructions
    parts.push('');
    parts.push('INSTRUKSI EKSEKUSI:');
    parts.push('1. Jalankan reasoning 5 pertanyaan dari Task Execution Protocol sebelum menulis pesan');
    parts.push('2. Tulis pesan yang akan dikirim ke customer — seperti admin biasa di WhatsApp');
    parts.push('3. Jika perlu pecah jadi beberapa pesan, pisahkan dengan |||');
    parts.push('4. Pesan HARUS terasa dari manusia, bukan template. Singkat, natural, ada hook spesifik.');
    parts.push('5. DILARANG bocorkan metadata internal ke customer (JSON, confidence, intent, score)');
    parts.push('6. DILARANG sebut harga di pesan pertama kecuali task type rescue atau customer sudah tanya');
    parts.push('7. DILARANG pakai numbered list, bold, atau format template');

    // Constraints
    const constraints: string[] = [];
    if (task.constraints.max_messages) {
      constraints.push(`Maks ${task.constraints.max_messages} pesan`);
    }
    if (task.constraints.no_pricing) {
      constraints.push('JANGAN bahas harga');
    }
    if (task.constraints.forbidden_topics?.length) {
      constraints.push(`Hindari topik: ${task.constraints.forbidden_topics.join(', ')}`);
    }
    if (task.constraints.tone) {
      constraints.push(`Tone: ${task.constraints.tone}`);
    }
    if (constraints.length > 0) {
      parts.push('');
      parts.push(`Constraints: ${constraints.join(' | ')}`);
    }

    // Output format
    parts.push('');
    parts.push('FORMAT OUTPUT:');
    parts.push('Tulis HANYA pesan yang akan dikirim ke customer, pisahkan dengan |||');
    parts.push('Di akhir, tambahkan metadata:');
    parts.push('[META]{"intent":"outreach|follow_up|rescue|qualification","confidence":0-1,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]');
    parts.push('');
    parts.push('Contoh output outreach:');
    parts.push('Halo kak, saya Mandala dari Jadisatu 👋|||Kami bantu bisnis UMKM biar nggak kehilangan leads karena admin kewalahan. Boleh tanya dulu, bisnis kakak sekarang bergerak di bidang apa?|||[META]{"intent":"outreach","confidence":0.8,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]');

    return parts.join('\n');
  }

  private buildUserMessage(context: AssembledContext, lastMessage: string): string {
    const parts = [
      `Customer mengirim: "${lastMessage}"`,
      '',
      'INSTRUKSI:',
      '1. Reply seperti admin biasa di WhatsApp (casual, singkat)',
      '2. Jika perlu pecah jadi beberapa pesan, pisahkan dengan |||',
      '3. Di akhir, tambahkan metadata dalam format:',
      '   [META]{"intent":"...","confidence":0-1,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh output:',
      'harganya 1.5jt per bulan kak|||itu udah include setup ya|||[META]{"intent":"answer_price","confidence":0.9,"score_delta":2,"should_flag":false,"flag_reason":""}[/META]',
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
