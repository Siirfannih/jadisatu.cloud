import { generateText } from './gemini-client.js';
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
      const userMessage = this.buildUserMessage(context, lastCustomerMessage.content);

      const text = await generateText({
        system: systemPrompt,
        user: userMessage,
        model: aiConfig.conversation_model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.max_tokens,
      });
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
      const userMessage = this.buildTaskUserMessage(task, context);

      console.log(`[ai-engine] System prompt size: ${systemPrompt.length} chars, user message: ${userMessage.length} chars`);

      const text = await generateText({
        system: systemPrompt,
        user: userMessage,
        model: aiConfig.conversation_model,
        temperature: aiConfig.temperature,
        maxTokens: aiConfig.max_tokens,
      });
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
      const text = await generateText({
        model: classifierModel,
        temperature: 0,
        maxTokens: 256,
        json: true,
        system: `Kamu adalah classifier. Analisa pesan customer berikut dan output JSON ONLY.
Context percakapan: ${conversationContext}`,
        user: `Analisa pesan ini: "${message}"

Output JSON:
{
  "intent": "asking_price|asking_product|objection|interested|not_interested|greeting|other",
  "buying_signal": 0-5,
  "is_target_market": true/false,
  "objection": "price|quality|trust|timing|none",
  "recommended_action": "continue|close|flag_owner"
}`,
      });
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
    parts.push('9. Biasanya akhiri dengan pertanyaan/hook yang memancing reply, tapi kalau customer singkat/ambigu, baca situasi dulu dan jangan maksa.');

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
      engagementGuide = 'LEVEL: COLD — belum kenal. Kamu TEMAN CURHAT, BUKAN sales. JANGAN sebut produk/layanan. Fokus 100% ke MEREKA — tanya, dengarkan, empati. Gali informasi secara natural. Biasanya akhiri dengan pertanyaan, KECUALI mereka capek/ambigu/mau-sudahan; saat itu baca perasaannya dulu, jangan maksa.';
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
      '   PERTANYAAN: biasanya pancing obrolan dengan pertanyaan/hook, TAPI bukan wajib tiap giliran. Kalau customer pendek/ambigu/capek/mau-sudahan ("capek", "udah ah", "gpp") JANGAN asumsi dan JANGAN dorong sales/topik baru. Baca dulu: tanya klarifikasi lembut soal perasaan/maksud mereka ("capek kenapa kak? sama kerjaan atau gimana?") atau kasih ruang. Lebih baik tanya daripada nebak salah.',
      '5. Jumlah bubble HARUS benar-benar bervariasi dan natural. JANGAN selalu pola "komentar + pertanyaan = 2 bubble" karena itu pola bot, gampang ketebak customer dan berisiko kedeteksi WhatsApp:',
      '   - 1 bubble: jawaban singkat ("oke kak"/"siap"), ATAU saat baca situasi ("capek kenapa kak?")',
      '   - 2 bubble: ack + lanjutan',
      '   - 3-4 bubble pendek: cerita atau jelasin bertahap',
      '   - Pilih sesuai ISI pesan, acak senatural manusia. Manusia TIDAK konsisten jumlah bubble-nya.',
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
      'POLA: biasanya ada pertanyaan/hook biar obrolan hidup, TAPI bukan hukum mati. Saat customer capek/ambigu/mau-sudahan, utamakan baca perasaan mereka dan boleh 1 bubble tanpa pertanyaan baru. Hindari dead-end yang dingin, tapi JANGAN maksa interogasi.',
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
        should_flag_owner: false, // tech/LLM errors are logged, not an owner [FLAG]
        flag_reason: 'AI engine error — need human intervention',
      },
    };
  }
}
