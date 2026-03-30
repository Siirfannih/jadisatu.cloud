import { getModel } from './gemini-client.js';
import { ContextAssembler } from './context-assembler.js';
import { isInternalMessage } from '../channels/message-guard.js';
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

      console.log(`[ai-engine] System prompt size: ${systemPrompt.length} chars, user message: ${userMessage.length} chars`);

      const result = await model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      });

      // Diagnostic: check for safety blocks or empty candidates
      const response = result.response;
      const candidates = response.candidates;
      const feedback = response.promptFeedback;
      if (!candidates || candidates.length === 0) {
        console.error('[ai-engine] Gemini returned 0 candidates!', {
          promptFeedback: JSON.stringify(feedback),
          blockReason: feedback?.blockReason,
        });
      } else {
        const finishReason = candidates[0].finishReason;
        if (finishReason && finishReason !== 'STOP') {
          console.warn(`[ai-engine] Gemini finish reason: ${finishReason}`, {
            safetyRatings: JSON.stringify(candidates[0].safetyRatings),
          });
        }
      }

      const text = response.text();
      console.log(`[ai-engine] Task raw response (${text.length} chars):`, text.slice(0, 500));
      const parsed = this.parseResponse(text);
      console.log(`[ai-engine] Task parsed: ${parsed.messages.length} messages, intent=${parsed.internal.intent}`);
      if (parsed.messages.length === 0 && text.length > 0) {
        // AI returned text but parsing produced 0 messages — treat the text as the message
        console.warn('[ai-engine] Fallback: using raw text as single message (no ||| found)');
        const cleanText = text.replace(/\[META\].*?\[\/META\]/s, '').trim();
        if (cleanText) {
          parsed.messages = [cleanText];
          parsed.delays = [0];
        }
      }
      return parsed;
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
    parts.push('6. DILARANG sebut produk, layanan, harga, atau apa yang kamu/Jadisatu jual di pesan outreach pertama');
    parts.push('7. DILARANG pakai numbered list, bold, atau format template');
    parts.push('8. Pesan outreach pertama HARUS fokus ke MEREKA (tanya kabar, tanya bisnis) — bukan tentang kamu atau Jadisatu');
    parts.push('9. WAJIB akhiri dengan pertanyaan atau hook yang MEMANCING customer reply. Jangan kirim pesan dead-end (hanya acknowledge tanpa lanjutan).');

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
    parts.push('Contoh output outreach (PERHATIKAN: tidak menyebut produk/layanan):');
    parts.push('halo kak, apa kabar?|||aku Mandala, boleh kenalan? 😊|||[META]{"intent":"outreach","confidence":0.8,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]');
    parts.push('');
    parts.push('Contoh output follow_up (PERHATIKAN: SELALU ada pertanyaan di akhir):');
    parts.push('wah seneng dengernya kak|||lagi ngerjain apa nih kak sekarang?|||[META]{"intent":"follow_up","confidence":0.8,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]');
    parts.push('');
    parts.push('Contoh SALAH (JANGAN ditiru):');
    parts.push('❌ "kami bantu bisnis biar ga pusing balasin chat" — ini JUALAN, bukan kenalan');
    parts.push('❌ "Jadisatu punya layanan..." — ini PITCHING, bukan rapport');
    parts.push('❌ menyebut AI, otomasi, setup, produk, layanan, solusi — DILARANG di outreach pertama');
    parts.push('❌ "wah seneng dengernya kak" (TANPA pertanyaan lanjutan) — ini DEAD-END, customer gak akan reply');

    return parts.join('\n');
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
      engagementGuide = 'LEVEL: COLD — belum kenal. Kamu TEMAN CURHAT, BUKAN sales. JANGAN sebut produk/layanan. Fokus 100% ke MEREKA — tanya, dengarkan, empati. Gali informasi secara natural. WAJIB akhiri dengan pertanyaan yang memancing mereka reply.';
    }

    const parts = [
      `Customer mengirim: "${lastMessage}"`,
      '',
      engagementGuide,
      '',
      'INSTRUKSI:',
      '1. BACA pesan customer di atas dengan teliti. Responsmu HARUS menjawab/menanggapi apa yang customer katakan atau tanyakan.',
      '2. DILARANG menjawab dengan informasi yang tidak ditanya oleh customer.',
      '3. Reply seperti admin biasa di WhatsApp — casual, natural, seperti chat sama teman.',
      '4. FOKUS ke customer dulu, bukan produk. Dengarkan, tanya, empati.',
      '   PENTING: SELALU akhiri dengan pertanyaan atau hook yang memancing customer reply. Jangan pernah kirim pesan yang jadi dead-end (hanya acknowledge tanpa lanjutan).',
      '5. Jumlah pesan HARUS BERVARIASI berdasarkan konteks:',
      '   - Jawaban singkat: 1 bubble saja ("oke kak" / "siap")',
      '   - Percakapan normal: 2-3 bubble',
      '   - Penjelasan detail: 4-6 bubble pendek',
      '   - JANGAN selalu kirim jumlah yang sama!',
      '6. Jika perlu pecah jadi beberapa pesan, pisahkan dengan |||',
      '7. Di akhir, tambahkan metadata: [META]{"intent":"...","confidence":0-1,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh output (variasi jumlah bubble):',
      '',
      'Contoh 1 bubble: oke kak, lagi sibuk apa nih sekarang?|||[META]{"intent":"rapport","confidence":0.9,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh 2 bubble: wah seneng dengernya kak|||lagi ngerjain apa nih kak sekarang?|||[META]{"intent":"rapport","confidence":0.8,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'Contoh 3 bubble: oh keren kak, sosmed management ya?|||pasti rame banget ya|||handle berapa klien kak sekarang?|||[META]{"intent":"discovery","confidence":0.8,"score_delta":3,"should_flag":false,"flag_reason":""}[/META]',
      '',
      'POLA WAJIB: Perhatikan setiap contoh di atas SELALU diakhiri pertanyaan. Ini WAJIB. Jangan pernah reply hanya "wah keren" atau "oke kak" tanpa lanjutan pertanyaan.',
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
    let cleanText = text.replace(/\[META\].*?\[\/META\]/s, '').trim();

    // Additional cleanup: strip any remaining internal artifacts
    cleanText = cleanText
      .replace(/\[MANDALA[^\]]*\]/gi, '')           // [MANDALA ...] tags
      .replace(/\[FLAG[^\]]*\]/gi, '')               // [FLAG ...] tags
      .replace(/\{[^}]*"intent"\s*:/gi, '')          // Leaked JSON metadata
      .replace(/\{[^}]*"confidence"\s*:/gi, '')
      .replace(/\{[^}]*"score_delta"\s*:/gi, '')
      .replace(/━+/g, '')                            // Report separators
      .replace(/\n{3,}/g, '\n\n')                    // Collapse excess newlines
      .trim();

    const messages = cleanText
      .split('|||')
      .map((m) => m.trim())
      .filter(Boolean)
      // Final safety: filter out any messages that still contain internal patterns
      .filter((m) => {
        const guard = isInternalMessage(m);
        if (guard.blocked) {
          console.warn(`[ai-engine] Stripped internal message from AI output: ${guard.reason}`);
          return false;
        }
        return true;
      });

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
