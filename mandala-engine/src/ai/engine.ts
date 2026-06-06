import { generateText } from './gemini-client.js';
import { ContextAssembler } from './context-assembler.js';
import { isInternalMessage } from '../channels/message-guard.js';
import type { AssembledContext, AIConfig, AIResponse } from '../types/shared.js';
import type { MandalaTask } from '../tasks/types.js';

/**
 * Build the per-turn reply instructions for an INBOUND customer message.
 *
 * Order matters and is enforced as an explicit reasoning pre-step:
 *   1. LANGUAGE   — detect the customer's language, mirror it (persona shapes tone, NOT language).
 *   2. INTENT STACK — a message can carry several intents; pick the PRIMARY by business priority.
 *                     A greeting is context, never the whole intent unless it is the only thing said.
 *   3. ACK → JAWAB → ARAH — acknowledge, answer the primary intent, open a business-relevant next step.
 *
 * The lead-score engagement band still gates how far Mandala may push PRODUCT for a prospect being
 * warmed up — but it is now SUBORDINATE to intent: if the customer explicitly asks price/product/
 * booking, answer the need regardless of how cold the score is.
 *
 * Exported (not just used by AIEngine) so the guardrails are unit-testable without an LLM call.
 */
export function buildReplyInstructions(lastMessage: string, leadScore: number): string {
  let engagementGuide: string;
  if (leadScore >= 70) {
    engagementGuide = 'LEVEL PROSPEK: HOT — sudah sangat tertarik. Boleh direct, bahas detail & pricing kalau ditanya. Tetap conversational.';
  } else if (leadScore >= 50) {
    engagementGuide = 'LEVEL PROSPEK: WARM — mulai terbuka. Boleh perkenalkan apa yang kamu kerjakan secara natural, hubungkan ke kebutuhan mereka. Jangan push.';
  } else if (leadScore >= 30) {
    engagementGuide = 'LEVEL PROSPEK: LUKEWARM — baru sedikit kenal. Bangun trust dulu, jangan obral produk.';
  } else {
    engagementGuide = 'LEVEL PROSPEK: COLD — belum kenal. Untuk pembuka/basa-basi, fokus ke MEREKA & bangun rapport, jangan dorong produk.';
  }

  return [
    `Customer mengirim: "${lastMessage}"`,
    '',
    '== DIAGNOSA DULU (lakukan dalam hati SEBELUM menulis) ==',
    '',
    '1. BAHASA (paling utama, tentukan dulu):',
    '   - Deteksi bahasa pesan customer. Balas dalam bahasa yang SAMA.',
    '   - Customer pakai English → balas English. Indonesia → Indonesia. Campur ID-EN → cermin campurannya secara natural.',
    '   - Bahasa customer MENANG atas persona brand. Persona mengatur TONE (santai/formal/hangat), BUKAN bahasa.',
    '   - Brand Indonesia boleh sisip sapaan lokal ("kak") HANYA kalau customer pakai ID atau campuran. JANGAN balas Indonesia ke customer yang murni English.',
    '   - Cermin formalitas: santai→santai, formal/marah→naik satu tingkat lebih rapi.',
    '',
    '2. INTENT STACK (pesan bisa punya >1 maksud — jangan paksa jadi 1 label):',
    '   Daftar semua maksud di pesan, lalu pilih PRIMARY berdasar prioritas (atas = menang):',
    '     1) keluhan/marah/isu sensitif/legal      → empati + after-sales/eskalasi',
    '     2) siap beli / bayar / konfirmasi booking → bantu closing',
    '     3) tanya harga / stok / ketersediaan / produk/jasa → jawab kebutuhannya (CS/sales)',
    '     4) keberatan / ragu / membandingkan       → tangani objection',
    '     5) status order / operasional             → bantu cek/selesaikan',
    '     6) sapaan (halo/selamat malam/hello)      → cukup di-ACK',
    '     7) basa-basi ringan                       → rapport ringan',
    '     8) tidak jelas / "mau tanya" saja         → KLARIFIKASI, jangan menebak',
    '   ATURAN:',
    '   - Sapaan TIDAK PERNAH mengalahkan intent bisnis. Sapaan + pertanyaan harga → JAWAB harganya, sapaan cukup jadi pembuka.',
    '   - Keluhan + sapaan → keluhan menang. Siap-beli + pertanyaan → siap-beli menang.',
    '   - GREETING-ONLY (tidak ada maksud lain): ACK hangat + TAWARKAN BANTUAN yang berorientasi layanan ("ada yang bisa aku bantu?" / "how can I help you today?"). DILARANG tanya hal personal seperti "lagi santai atau sibuk?" — itu off-topic & bukan konteks layanan.',
    '   - Kalau ragu intent-nya apa → klarifikasi singkat, jangan asal jawab.',
    '',
    '== BALAS pakai ACK → JAWAB → ARAH ==',
    '- ACK: akui sapaan/maksud customer dengan singkat & natural.',
    '- JAWAB: jawab PRIMARY intent. Kalau butuh data (harga/stok/jadwal/ketersediaan) yang TIDAK ada di knowledge/brand memory → JANGAN mengarang. Bilang jujur "aku cekkan dulu biar nggak salah info ya" lalu lanjut kualifikasi.',
    '- ARAH: satu langkah berikutnya yang RELEVAN ke kebutuhan bisnis customer (mis. minta tanggal/jumlah orang/varian/no. order) — BUKAN pertanyaan personal yang tidak nyambung.',
    '',
    engagementGuide,
    'PENTING: level prospek di atas hanya mengatur seberapa jauh kamu menyinggung PRODUK untuk prospek yang lagi dihangatkan. Kalau customer EKSPLISIT minta harga/produk/booking, LAYANI kebutuhannya apa pun levelnya — jangan ditahan.',
    '',
    '== FORMAT ==',
    '- Reply seperti admin sungguhan di chat — natural, mengalir, anti AI-slop.',
    '- Jumlah bubble BERVARIASI sesuai konteks: jawaban singkat 1 bubble, normal 2-3, penjelasan 4-6 bubble pendek. Jangan selalu sama.',
    '- Pisahkan bubble dengan |||',
    '- Akhiri dengan metadata: [META]{"intent":"...","confidence":0-1,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
    '',
    '== CONTOH (perhatikan: BAHASA dicerminkan, sapaan tidak menelan intent bisnis, langkah berikutnya relevan) ==',
    '',
    'EN, sapaan saja:',
    'Good evening! Thanks for reaching out, how can I help you today?|||[META]{"intent":"greeting","confidence":0.9,"score_delta":2,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'ID, sapaan saja:',
    'selamat malam kak 😊|||ada yang bisa aku bantu?|||[META]{"intent":"greeting","confidence":0.9,"score_delta":2,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'ID, sapaan + tanya harga (data harga ADA):',
    'selamat malam kak 😊 ada pricelist-nya|||kakak rencana menginap tanggal berapa dan untuk berapa orang? biar aku bantu cekkan harga yang paling pas|||[META]{"intent":"asking_price","confidence":0.9,"score_delta":12,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'ID, sapaan + tanya harga (data harga TIDAK ADA — jangan ngarang):',
    'selamat malam kak 😊 ada pricelist-nya, tapi aku cekkan dulu biar nggak salah info ya|||kakak rencana menginap tanggal berapa dan untuk berapa orang?|||[META]{"intent":"asking_price","confidence":0.9,"score_delta":12,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'EN, sapaan + tanya harga:',
    'Good evening! Yes, we have a room pricelist 😊|||may I know your check-in date and how many guests, so I can suggest the most suitable option?|||[META]{"intent":"asking_price","confidence":0.9,"score_delta":12,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'ID, sapaan + keluhan (keluhan menang):',
    'halo kak, maaf ya pesanannya belum sampai 🙏|||aku bantu cek sekarang, boleh kirim nomor ordernya?|||[META]{"intent":"complaint","confidence":0.9,"score_delta":0,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'ID, siap beli:',
    'hai kak, siap 😊 sage size L aku cekkan dulu ya|||kalau ready, mau dikirim ke alamat yang sama atau alamat baru?|||[META]{"intent":"ready_to_buy","confidence":0.9,"score_delta":18,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'Campuran ID-EN (cermin campurannya):',
    'halo kak, yes ada pricelist untuk villa|||kakak rencana stay tanggal berapa dan untuk berapa orang?|||[META]{"intent":"asking_price","confidence":0.85,"score_delta":12,"should_flag":false,"flag_reason":""}[/META]',
    '',
    'Vague ("kak mau tanya") → klarifikasi:',
    'boleh kak 😊|||mau tanya soal produk, harga, booking, atau pesanan yang lagi berjalan?|||[META]{"intent":"other","confidence":0.6,"score_delta":3,"should_flag":false,"flag_reason":""}[/META]',
    '',
    '== CONTOH SALAH (JANGAN ditiru) ==',
    '❌ Customer "Hello good evening" dibalas "halo kak, good evening juga 🙏 lagi santai atau masih sibuk nih?" — SALAH bahasa (EN dibalas ID) + pertanyaan personal off-topic. Benar: "Good evening! Thanks for reaching out, how can I help you today?"',
    '❌ Sapaan + tanya harga tapi cuma dijawab sapaannya doang — intent bisnis ketelan.',
    '❌ Mengarang harga/stok/jadwal yang belum dikonfirmasi brand.',
    '❌ Pesan dead-end tanpa langkah berikutnya.',
    '',
    '== SELF-CHECK sebelum kirim (kalau ada yang gagal, TULIS ULANG) ==',
    '[ ] Bahasa balasan = bahasa customer?',
    '[ ] Primary intent terjawab (bukan cuma sapaannya)?',
    '[ ] Sapaan di-ACK tanpa menelan intent bisnis?',
    '[ ] Langkah berikutnya relevan ke kebutuhan customer (bukan pertanyaan personal)?',
    '[ ] Tidak mengarang harga/stok/jadwal?',
    '[ ] Tidak dead-end?',
  ].join('\n');
}

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
    // Determine engagement context from lead score; intent-aware reply scaffold
    // (language mirror → intent stack → ACK/JAWAB/ARAH) lives in buildReplyInstructions.
    const score = context.lead_score?.score ?? 0;
    return buildReplyInstructions(lastMessage, score);
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
