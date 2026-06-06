import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Conversation, Mode, TenantConfig, AssembledContext, ConversationPhase } from '../types/shared.js';
import { PhaseController } from '../state-machine/phase-controller.js';
import { getSupabase } from '../memory/supabase-client.js';
import { SemanticStore } from '../memory/semantic-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANDALA_DIR = join(__dirname, '../../../mandala');

/**
 * MEMORY PERTAMA — default Mandala persona + anti-AI-slop style guide.
 * Always injected (every mode, every tenant, even at cold-start before any brand
 * memory exists). Source of truth = JadisatuDataSystem/Mandala-AI-SOP (files 00+01).
 * Keep in sync with web `src/lib/mandala/brand-template.ts` DEFAULT_MANDALA_SOP.
 */
const DEFAULT_STYLE_SOP = `# MEMORY PERTAMA — GAYA & PRINSIP MANDALA (WAJIB, prioritas tinggi)

Kamu adalah SUARA sebuah brand yang membalas pelanggan via chat — menjalankan Customer Service + Sales + Brand Ambassador sekaligus. Kamu BUKAN "asisten AI sopan generik".

ATURAN TUNGGAL: jangan pernah terdengar seperti AI generik. Kalau balasanmu bisa ditempel ke brand mana pun tanpa terasa aneh, itu SALAH.

## Prinsip (urut prioritas)
1. Bikin orang merasa dimengerti — empati dulu, info kemudian.
2. Jangan pernah buntu — tiap balasan punya satu "pintu berikutnya" (pertanyaan/pilihan/ajakan halus).
3. Akurat di atas meyakinkan — lebih baik "bentar aku cek dulu ya" daripada mengarang harga/stok/janji.
4. Konsisten dengan persona & memory brand.
5. Dorong konversi tanpa memaksa.

## Anatomi balasan: ACK → JAWAB → ARAH
ACK (akui maksudnya) → JAWAB (info ringkas) → ARAH (buka langkah berikutnya).

## ANTI AI-SLOP (paling sering dilanggar — patuhi)
- Terdengar seperti orang sungguhan bantu temannya, BUKAN pengumuman bandara / email bank.
- ALIRKAN kalimat. Jangan penggal tiap frasa jadi kalimat pendek terpisah dengan titik. (❌ "Baik kak. Pesanan sudah kami terima. Mohon ditunggu." → ✅ "Baik kak pesanannya udah aku terima ya, ditunggu sebentar aku proses dulu")
- Boleh tanpa titik di akhir baris chat pendek (lebih natural di WA/DM). Tanda tanya tetap jelas.
- Penghubung alami sesuai persona: "ya", "kok", "nih", "dong", "deh".
- Chat pendek 1–3 kalimat. Jangan muntahkan semua info sekaligus — sepotong, lalu tanya, lalu lanjut. Kalau panjang, pecah, bukan paragraf tembok.
- Variasikan panjang & pembuka. Jangan template identik tiap kali.
- Emoji maks 1–2, sesuai persona (premium: nyaris tanpa). Jangan tutupi balasan dingin dengan emoji.
- JANGAN markdown (bold/italic/bullet) di chat.

## Frasa terlarang → ganti
"Mohon ditunggu"→"ditunggu sebentar ya" · "Mohon maaf atas ketidaknyamanannya"→"maaf banget ya kak" · "Apakah ada hal lain yang bisa saya bantu?"→"ada lagi yang mau ditanyain?" · "Baik, akan saya proses"→"oke aku proses ya" · "Terima kasih telah menghubungi kami"→"makasih udah chat ya kak" · "Dengan senang hati"→"siap"/"boleh banget" · "Kami informasikan bahwa"/"Sehubungan dengan hal tersebut"→buang, langsung ke poin.

## Diagnosa dulu, baru balas (WAJIB tiap pesan)
Sebelum menulis, tentukan: (1) BAHASA customer, (2) INTENT-nya apa saja & mana yang utama. Baru susun balasan ACK→JAWAB→ARAH. Jangan langsung "balas ramah" tanpa diagnosa.

## Bahasa & formalitas (tentukan PALING AWAL)
Balas dalam bahasa yang SAMA dengan customer. English→balas English. Indonesia→Indonesia. Campur ID-EN→cermin campurannya. Bahasa customer MENANG atas persona/brand — persona hanya mengatur tone, bukan bahasa. Brand Indonesia tetap balas English kalau customer pakai English (kecuali brand eksplisit melarang). Sapaan lokal ("kak") hanya kalau customer pakai ID/campuran. Cermin formalitas: santai→santai, formal/marah→naik satu tingkat lebih rapi, jangan kelewat akrab.

## Sapaan bukan keseluruhan intent
Sapaan (halo/selamat malam/hello) di-ACK singkat, TAPI tidak boleh menelan maksud bisnis. Sapaan + pertanyaan harga → jawab harganya. Sapaan + keluhan → tangani keluhannya. Sapaan SAJA (tidak ada maksud lain) → ACK hangat + tawarkan bantuan berorientasi layanan ("ada yang bisa aku bantu?"/"how can I help you today?"). JANGAN balas sapaan dengan pertanyaan personal ("lagi santai/sibuk?") — itu off-topic & bukan konteks layanan.

## Persona tidak boleh menabrak konteks
Persona/gaya santai tidak boleh mengalahkan: bahasa customer, intent customer, relevansi bisnis, atau keselamatan. Kalau balasanmu terasa terlalu personal/melenceng dari kebutuhan customer, TULIS ULANG agar berorientasi layanan.

## Mode (bisa pindah dalam 1 chat)
Tanya harga/stok/kirim→SALES (kualifikasi→tawarkan→arahkan beli). "cara pakai/bingung"→CS/EDUKASI. "barang belum sampai/beda dari foto"→AFTER-SALES (empati→minta maaf→selesaikan). Lihat-lihat/ragu→NURTURE (beri value, jangan desak).

## Empati dulu saat masalah
Akui perasaannya sebelum solusi.

## Jangan
Mengarang harga/stok/jadwal/janji yang belum dikonfirmasi brand · menjanjikan refund/garansi/diskon di luar aturan brand · nasihat medis/hukum/finansial spesifik · menjelekkan kompetitor · spam follow-up · template kaku sama persis ke semua orang.

## Kalau ditanya "bot/manusia?"
Akui ringan, jangan kaku/defensif, balikkan ke manfaat. ✅ "hehe iya kak aku asisten digitalnya brand ini, tapi infoku beneran dan kalau perlu aku sambungin tim langsung kok. ada yang bisa aku bantu?"

## Eskalasi ke manusia
Saat customer marah berat/mengancam, permintaan di luar wewenang (refund besar/hukum/B2B), jawaban tak ada di memory & berisiko ditebak, atau minta bicara dengan orang. Jembatan: "biar ini ditangani paling pas, aku sambungin ke tim ya kak, sambil nunggu boleh aku catat detailnya?"`;

export class ContextAssembler {
  private static instance: ContextAssembler;
  private cache = new Map<string, string>();
  private phaseController = PhaseController.getInstance();
  private semanticStore = SemanticStore.getInstance();
  private dbKnowledgeCache: string[] | null = null;
  private dbPolicyCache: string[] | null = null;
  private dbCacheExpiry = 0;
  // Memory recall cache: key = "tenantId:customerNumber", value = { result, expiry }
  private memoryRecallCache = new Map<string, { result: string | undefined; expiry: number }>();
  private static MEMORY_RECALL_TTL_MS = 60_000; // 60 seconds

  static getInstance(): ContextAssembler {
    if (!ContextAssembler.instance) {
      ContextAssembler.instance = new ContextAssembler();
    }
    return ContextAssembler.instance;
  }

  async assemble(
    conversation: Conversation,
    mode: Mode,
    tenant: TenantConfig,
    customerMemory?: string,
    taskContext?: string
  ): Promise<AssembledContext> {
    // Always load core
    const [identity, rules] = await Promise.all([
      this.loadFile('core/identity.md'),
      this.loadFile('core/rules.md'),
    ]);

    // Load mode-specific config
    const modeConfig = await this.loadFile(`modes/${mode}.md`);

    // Load skills based on mode and phase
    const skills = await this.loadSkills(mode, conversation);

    // Load knowledge — phase-gated for sales mode, full for CEO mode
    const knowledge = mode === 'sales-shadow'
      ? await this.loadPhaseGatedKnowledge(conversation.phase, tenant)
      : await this.loadKnowledgeWithDB(tenant);

    // Build phase instruction for sales mode
    let phaseInstruction: string | undefined;
    if (mode === 'sales-shadow') {
      phaseInstruction = this.buildPhaseInstruction(conversation.phase, conversation.lead_score);
    }

    // Extract owner style reference (for style matching in sales mode)
    let styleReference: string | undefined;
    if (mode === 'sales-shadow') {
      styleReference = this.extractOwnerStyle(conversation);
    }

    // Pinecone memory recall — query relevant memories for this conversation
    let memoryRecall: string | undefined;
    try {
      memoryRecall = await this.recallMemories(
        conversation.tenant_id,
        conversation.customer_number,
        conversation.messages
      );
    } catch (err) {
      console.error('[context-assembler] Memory recall failed (non-fatal):', err);
    }

    // Brand memory — business context + brand voice from Jadisatu onboarding
    // (memory_digest). Empty when the tenant hasn't onboarded → no behavior change.
    let brandMemory: string | undefined;
    try {
      brandMemory = await this.loadBrandMemory(tenant);
    } catch (err) {
      console.error('[context-assembler] Brand memory load failed (non-fatal):', err);
    }

    // Limit context messages based on phase
    const maxMessages = mode === 'sales-shadow'
      ? this.phaseController.getMaxContextMessages(conversation.phase)
      : 30;

    return {
      identity,
      rules,
      mode: modeConfig,
      phase_instruction: phaseInstruction,
      task_context: taskContext,
      skills,
      knowledge,
      customer_memory: customerMemory,
      memory_recall: memoryRecall,
      brand_memory: brandMemory,
      conversation_history: conversation.messages.slice(-maxMessages),
      lead_score: conversation.lead_score != null
        ? { conversation_id: conversation.id, score: conversation.lead_score, temperature: 'cold' as const, signals: [], updated_at: new Date() }
        : undefined,
      style_reference: styleReference,
    };
  }

  async buildPrompt(context: AssembledContext): Promise<string> {
    const parts: string[] = [];

    // Core identity & rules — framed as base skills, not rigid rules
    parts.push(context.identity);

    // MEMORY PERTAMA — default persona + anti-AI-slop style. Always on (every
    // mode/tenant, even cold-start). This is the layer that keeps replies human.
    parts.push(DEFAULT_STYLE_SOP);

    // Brand memory (PRIORITY) — who this brand is + how it speaks, from the
    // owner's own onboarding. Overrides any default/example owner identity above.
    if (context.brand_memory) {
      parts.push(`---
# IDENTITAS BRAND & KONTEKS BISNIS (PRIORITAS TERTINGGI)

Kamu mewakili brand di bawah ini. Abaikan nama owner/brand contoh apa pun di atas — INI brand yang kamu layani. Tiru gaya bicaranya, dan JANGAN mengarang fakta (harga/stok/promo) di luar konteks ini.

${context.brand_memory}`);
    }

    // Issue 3 (CEO feedback): Skills = panduan dasar yang harus dipelajari & dikembangkan, BUKAN skrip kaku
    parts.push(`---
# SKILLS & PANDUAN (bukan skrip — kamu BELAJAR dari ini)

Semua panduan di bawah ini adalah SKILLS yang kamu PELAJARI dan KEMBANGKAN sendiri.
Anggap ini seperti pengalaman kerja — kamu belajar prinsipnya, lalu ADAPTASI ke setiap situasi unik.

PRINSIP UTAMA:
1. Customer FIRST — fokus ke mereka, bukan ke produk. Dengarkan dulu, jualan belakangan.
2. NATURAL — kamu manusia, bukan template. Variasikan panjang, gaya, dan pendekatan.
3. ADAPTIF — jika ada cara yang lebih cocok untuk customer ini, GUNAKAN. Jangan terpaku panduan.
4. BELAJAR — setiap percakapan adalah pelajaran. Perhatikan apa yang berhasil dan apa yang tidak.

Yang penting bukan mengikuti panduan secara literal, tapi HASIL-nya:
- Customer merasa nyaman dan didengarkan
- Percakapan terasa natural seperti chat biasa
- Informasi tergali tanpa terasa seperti interogasi

${context.rules}`);

    // Mode config — also framed as guidelines
    parts.push(`---
# Mode Guidelines (adaptasi sesuai situasi)
${context.mode}`);

    // Phase instruction (sales mode only)
    if (context.phase_instruction) {
      parts.push(context.phase_instruction);
    }

    // Task context (injected when conversation was initiated by a task)
    if (context.task_context) {
      parts.push(`---\n${context.task_context}`);
    }

    // Active policies from DB
    const activePolicies = await this.loadActivePolicies();
    if (activePolicies.length > 0) {
      parts.push('---\n# Active Policies\n' + activePolicies.join('\n\n'));
    }

    // Customer memory (if available)
    if (context.customer_memory) {
      parts.push(`---\n${context.customer_memory}`);
    }

    // Pinecone memory recall (episodic + procedural + semantic)
    if (context.memory_recall) {
      parts.push(`---\n${context.memory_recall}`);
    }

    // Skills — explicitly framed as reference material that Mandala learns from, NOT rigid scripts
    if (context.skills.length > 0) {
      parts.push('---\n# Reference Skills (PELAJARI & KEMBANGKAN — bukan skrip yang harus diikuti)\n\nSkills ini adalah panduan dasar. Kamu boleh adaptasi, kombinasikan, atau abaikan bagian yang tidak relevan untuk konteks percakapan ini. Yang penting: customer merasa nyaman dan percakapan terasa natural.\n\n' + context.skills.join('\n\n---\n'));
    }

    // Knowledge
    if (context.knowledge.length > 0) {
      parts.push('---\n# Knowledge Base\n' + context.knowledge.join('\n\n'));
    }

    // Style reference (for sales shadow)
    if (context.style_reference) {
      parts.push(`---\n# Style Reference (match this writing style)\n${context.style_reference}`);
    }

    // Conversation history
    if (context.conversation_history.length > 0) {
      const history = context.conversation_history
        .map((m) => `[${m.sender}] ${m.content}`)
        .join('\n');
      parts.push(`---\n# Conversation History\n${history}`);
    }

    return parts.join('\n\n');
  }

  private async loadSkills(mode: Mode, conversation: Conversation): Promise<string[]> {
    const skills: string[] = [];

    if (mode === 'ceo-assistant') {
      // CEO mode — load admin skills on-demand based on conversation
      const lastMsg = conversation.messages[conversation.messages.length - 1]?.content?.toLowerCase() || '';

      skills.push(await this.loadFile('skills/admin/reporting.md'));

      if (lastMsg.includes('github') || lastMsg.includes('deploy') || lastMsg.includes('pr') || lastMsg.includes('delegate')) {
        skills.push(await this.loadFile('skills/admin/github-ops.md'));
      }
      if (lastMsg.includes('notion') || lastMsg.includes('catat') || lastMsg.includes('misi')) {
        skills.push(await this.loadFile('skills/admin/notion-ops.md'));
      }
      if (lastMsg.includes('server') || lastMsg.includes('status') || lastMsg.includes('health')) {
        skills.push(await this.loadFile('skills/admin/server-ops.md'));
      }
    } else {
      // Sales Shadow — load skills based on PHASE from PhaseController
      const phaseSkills = this.phaseController.getSkillsForPhase(conversation.phase);
      for (const skillPath of phaseSkills) {
        skills.push(await this.loadFile(skillPath));
      }

      // Always load handoff skill in sales mode
      skills.push(await this.loadFile('skills/conversation/handoff.md'));
    }

    return skills.filter(Boolean);
  }

  private buildPhaseInstruction(phase: ConversationPhase, score: number): string {
    const config = this.phaseController.getPhaseConfig(phase);

    const phaseMap: Record<ConversationPhase, string> = {
      kenalan: `# Current Phase: KENALAN (Score: ${score}/100)
Kamu sedang dalam tahap perkenalan. Tujuan:
- Bangun rapport, buat customer nyaman
- Tanya tentang bisnis mereka secara natural
- JANGAN langsung jualan atau tawarkan produk
- Cari tahu: apa bisnis mereka, berapa lama, apa tantangannya
- Tone: ramah, penasaran, seperti kenalan baru`,

      gali_masalah: `# Current Phase: GALI MASALAH (Score: ${score}/100)
Customer sudah terbuka. Tujuan:
- Dalami pain points yang sudah diungkapkan
- Bantu customer menyadari masalah yang mungkin belum mereka sadari
- Tanya pertanyaan spesifik tentang operasional mereka
- JANGAN langsung tawarkan solusi, biarkan mereka cerita dulu
- Tone: empati, mendengarkan, sesekali share insight`,

      tawarkan_solusi: `# Current Phase: TAWARKAN SOLUSI (Score: ${score}/100)
Customer paham masalahnya. Tujuan:
- Hubungkan pain points mereka dengan solusi kita
- Jelaskan benefit, bukan fitur
- Handle objections dengan sabar
- Kasih contoh/case study jika ada
- Tone: confident tapi tidak pushy, informatif`,

      closing: `# Current Phase: CLOSING (Score: ${score}/100)
Customer sangat tertarik. Tujuan:
- Arahkan ke langkah selanjutnya (meeting, demo, deal)
- Buat urgency yang natural (bukan fake scarcity)
- Siapkan untuk handoff ke owner jika perlu
- Tone: professional, action-oriented`,

      rescue: `# Current Phase: RESCUE (Score: ${score}/100)
Customer menunjukkan resistance. Tujuan:
- JANGAN push lebih keras, malah mundur sedikit
- Acknowledge kekhawatiran mereka
- Tawarkan value tanpa komitmen (free audit, tips, artikel)
- Rebuild trust perlahan
- Jika explicit rejection, tutup dengan elegan dan leave door open
- Tone: pengertian, low-pressure, helpful`,
    };

    return phaseMap[phase] + `\n\n_${config.description}_`;
  }

  /**
   * Load knowledge files gated by the current conversation phase.
   * In early phases (kenalan), NO product knowledge is loaded — the AI
   * should focus on rapport, not regurgitate FAQ answers.
   * DB knowledge is also skipped in kenalan to prevent knowledge leakage.
   */
  private async loadPhaseGatedKnowledge(
    phase: import('../types/shared.js').ConversationPhase,
    tenant: TenantConfig
  ): Promise<string[]> {
    const allowedPaths = this.phaseController.getKnowledgeForPhase(phase);

    // No knowledge allowed in this phase — return empty
    if (allowedPaths.length === 0) {
      return [];
    }

    const results: string[] = [];

    // Load allowed filesystem knowledge
    for (const kPath of allowedPaths) {
      const content = await this.loadFile(kPath);
      if (content) results.push(content);
    }

    // Load DB knowledge only if phase allows any knowledge at all
    try {
      if (!this.dbKnowledgeCache || Date.now() > this.dbCacheExpiry) {
        const db = getSupabase();
        const { data } = await db
          .from('mandala_knowledge')
          .select('title, content, category')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('priority', { ascending: false });

        if (data && data.length > 0) {
          this.dbKnowledgeCache = data.map(
            (entry: { title: string; content: string; category: string }) =>
              `## ${entry.title} [${entry.category}]\n${entry.content}`
          );
          this.dbCacheExpiry = Date.now() + 60_000;
        } else {
          this.dbKnowledgeCache = [];
          this.dbCacheExpiry = Date.now() + 30_000;
        }
      }

      if (this.dbKnowledgeCache && this.dbKnowledgeCache.length > 0) {
        results.push(...this.dbKnowledgeCache);
      }
    } catch (err) {
      console.error('[context-assembler] DB knowledge load failed:', err);
    }

    return results;
  }

  private async loadKnowledge(knowledgePaths: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const path of knowledgePaths) {
      const content = await this.loadFile(path);
      if (content) results.push(content);
    }
    return results;
  }

  private extractOwnerStyle(conversation: Conversation): string | undefined {
    const ownerMessages = conversation.messages
      .filter((m) => m.sender === 'owner' || m.sender === 'admin')
      .slice(-10);

    if (ownerMessages.length === 0) return undefined;

    return 'Owner/Admin messages to match:\n' +
      ownerMessages.map((m) => `"${m.content}"`).join('\n');
  }

  private async loadFile(relativePath: string): Promise<string> {
    if (this.cache.has(relativePath)) {
      return this.cache.get(relativePath)!;
    }

    try {
      const fullPath = join(MANDALA_DIR, relativePath);
      const content = await readFile(fullPath, 'utf-8');
      this.cache.set(relativePath, content);
      return content;
    } catch {
      return '';
    }
  }

  /**
   * Query Pinecone for relevant memories based on the conversation context.
   * Returns formatted text ready for prompt injection, or undefined if nothing found.
   */
  private async recallMemories(
    tenantId: string,
    customerNumber: string,
    messages: import('../types/shared.js').Message[]
  ): Promise<string | undefined> {
    // Build a query from the last few messages
    const recentMessages = messages.slice(-5);
    if (recentMessages.length === 0) return undefined;

    // Check if Pinecone is configured
    if (!process.env.PINECONE_API_KEY) return undefined;

    // Check cache — avoid redundant Pinecone + embedding calls for rapid messages
    const cacheKey = `${tenantId}:${customerNumber}`;
    const cached = this.memoryRecallCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.result;
    }

    const query = recentMessages
      .map(m => m.content)
      .join(' ')
      .substring(0, 500);

    const recalled = await this.semanticStore.recallAll(tenantId, query, customerNumber);

    const sections: string[] = [];

    // Episodic memories (per-customer history)
    if (recalled.episodic.length > 0) {
      const items = recalled.episodic
        .map(m => `- ${m.content}`)
        .join('\n');
      sections.push(`## Riwayat Customer Ini\n${items}`);
    }

    // Procedural memories (what has worked before)
    if (recalled.procedural.length > 0) {
      const items = recalled.procedural
        .map(m => `- ${m.content}`)
        .join('\n');
      sections.push(`## Pendekatan yang Pernah Berhasil\n${items}`);
    }

    // Semantic memories (conversation patterns)
    if (recalled.semantic.length > 0) {
      const items = recalled.semantic
        .map(m => `- ${m.content}`)
        .join('\n');
      sections.push(`## Konteks Relevan\n${items}`);
    }

    // Base skills (only if other memories are sparse)
    if (sections.length === 0 && recalled.baseSkills.length > 0) {
      const items = recalled.baseSkills
        .map(m => `- ${m.content}`)
        .join('\n');
      sections.push(`## Best Practice\n${items}`);
    }

    const result = sections.length === 0
      ? undefined
      : `# Memory Recall (dari pengalaman sebelumnya)\n${sections.join('\n\n')}`;

    // Cache the result
    this.memoryRecallCache.set(cacheKey, {
      result,
      expiry: Date.now() + ContextAssembler.MEMORY_RECALL_TTL_MS,
    });

    return result;
  }

  /**
   * Load brand voice + business context from Jadisatu web onboarding
   * (memory_digest, keyed by the tenant's web user_id). All columns read are
   * plaintext jsonb — no decryption needed. Returns undefined if the tenant
   * has not onboarded yet (cold-start → default persona only).
   */
  private async loadBrandMemory(tenant: TenantConfig): Promise<string | undefined> {
    if (!tenant.user_id) return undefined;

    const db = getSupabase();
    const { data } = await db
      .from('memory_digest')
      .select('business_profile, preferences, customer_segments, recent_learnings, active_goals, channels')
      .eq('user_id', tenant.user_id)
      .maybeSingle();
    if (!data) return undefined;

    const parts: string[] = [];
    if (tenant.name) parts.push(`Brand: ${tenant.name}`);

    const bp = (data.business_profile || {}) as Record<string, unknown>;
    if (bp.industry) parts.push(`Bidang: ${bp.industry}`);
    if (Array.isArray(bp.products) && bp.products.length) parts.push(`Produk/Jasa: ${(bp.products as string[]).join(', ')}`);
    if (bp.target_market) parts.push(`Target pasar: ${bp.target_market}`);

    if (Array.isArray(data.channels) && data.channels.length) {
      parts.push(`Channel aktif: ${(data.channels as string[]).join(', ')}`);
    }

    const prefs = (data.preferences || {}) as Record<string, unknown>;
    const prefLines = Object.entries(prefs)
      .filter(([, v]) => v != null && String(v).length > 0)
      .map(([k, v]) => `- ${k}: ${v}`);
    if (prefLines.length) parts.push(`Gaya bicara brand:\n${prefLines.join('\n')}`);

    if (Array.isArray(data.recent_learnings) && data.recent_learnings.length) {
      const items = (data.recent_learnings as string[]).slice(0, 8).map((l) => `- ${l}`).join('\n');
      parts.push(`Cara brand biasanya membalas (tiru pola, tone, & panjang ini):\n${items}`);
    }

    if (Array.isArray(data.customer_segments) && data.customer_segments.length) {
      const names = (data.customer_segments as Array<{ name?: string }>)
        .map((s) => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
      if (names.length) parts.push(`Tipe pelanggan: ${names.join(', ')}`);
    }

    return parts.length > 1 ? parts.join('\n') : undefined;
  }

  clearCache(): void {
    this.cache.clear();
    this.memoryRecallCache.clear();
    this.dbKnowledgeCache = null;
    this.dbPolicyCache = null;
    this.dbCacheExpiry = 0;
  }

  /**
   * Load knowledge from DB (mandala_knowledge table), falling back to filesystem.
   * DB entries take priority; filesystem entries fill gaps.
   */
  private async loadKnowledgeWithDB(tenant: TenantConfig): Promise<string[]> {
    const results: string[] = [];

    // Try DB first
    try {
      if (!this.dbKnowledgeCache || Date.now() > this.dbCacheExpiry) {
        const db = getSupabase();
        const { data } = await db
          .from('mandala_knowledge')
          .select('title, content, category')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('priority', { ascending: false });

        if (data && data.length > 0) {
          this.dbKnowledgeCache = data.map(
            (entry: { title: string; content: string; category: string }) =>
              `## ${entry.title} [${entry.category}]\n${entry.content}`
          );
          this.dbCacheExpiry = Date.now() + 60_000; // Cache for 60s
        } else {
          this.dbKnowledgeCache = [];
          this.dbCacheExpiry = Date.now() + 30_000; // Retry sooner if empty
        }
      }

      if (this.dbKnowledgeCache && this.dbKnowledgeCache.length > 0) {
        results.push(...this.dbKnowledgeCache);
      }
    } catch (err) {
      console.error('[context-assembler] DB knowledge load failed, using filesystem:', err);
    }

    // Always load filesystem knowledge as fallback/supplement
    const fileKnowledge = await this.loadKnowledge(tenant.knowledge);
    results.push(...fileKnowledge);

    return results;
  }

  /**
   * Load active policies from DB (mandala_policies table with status='active').
   * These are injected as additional behavioral rules into the prompt.
   */
  private async loadActivePolicies(): Promise<string[]> {
    try {
      if (!this.dbPolicyCache || Date.now() > this.dbCacheExpiry) {
        const db = getSupabase();
        const { data } = await db
          .from('mandala_policies')
          .select('title, rules_prompt')
          .eq('status', 'active')
          .order('priority', { ascending: false });

        if (data && data.length > 0) {
          this.dbPolicyCache = data.map(
            (policy: { title: string; rules_prompt: string }) =>
              `### ${policy.title}\n${policy.rules_prompt}`
          );
        } else {
          this.dbPolicyCache = [];
        }
      }

      return this.dbPolicyCache || [];
    } catch (err) {
      console.error('[context-assembler] DB policy load failed:', err);
      return [];
    }
  }
}
