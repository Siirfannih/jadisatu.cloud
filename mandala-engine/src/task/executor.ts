import crypto from 'crypto';
import { getModel } from '../ai/gemini-client.js';
import { WhatsAppAdapter } from '../channels/whatsapp.js';
import { ConversationStore } from '../memory/conversation-store.js';
import { getSupabase } from '../memory/supabase-client.js';
import { TenantManager } from '../tenants/manager.js';
import { QuestionBook } from './question-book.js';
import { TargetIntel } from './target-intel.js';
import type {
  TaskInput,
  TaskState,
  TaskReasoning,
  DraftedMessage,
  MessagePart,
  SelfCheckResult,
  SelfCheckItem,
  TaskReport,
  TargetProfile,
  CustomerEngagementLevel,
} from './types.js';

/**
 * Task Executor — Full 5-stage pipeline from the Mandala Task Execution Protocol.
 *
 * Stage 1: PARSE & VALIDASI (QuestionBook)
 * Stage 2: REASONING & STRATEGI (this module — AI-powered reasoning)
 * Stage 3: DRAFT & SELF-CHECK (this module — message generation + validation)
 * Stage 4: EKSEKUSI (WhatsApp send with natural delays)
 * Stage 5: TRACKING & LAPORAN (report back to owner)
 */
export class TaskExecutor {
  private static instance: TaskExecutor;
  private questionBook = QuestionBook.getInstance();
  private intel = TargetIntel.getInstance();
  private wa = WhatsAppAdapter.getInstance();
  private store = ConversationStore.getInstance();
  private tenantManager = TenantManager.getInstance();

  static getInstance(): TaskExecutor {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }

  /**
   * Execute a task through the full 5-stage pipeline.
   * Returns the task state at each stage — can be paused at needs_clarification.
   */
  async execute(input: TaskInput): Promise<TaskState> {
    const taskId = crypto.randomUUID();
    const tenantId = input.tenant_id || 'mandala';
    const tenant = this.tenantManager.get(tenantId);
    const classifierModel = tenant?.ai?.classifier_model || 'gemini-2.0-flash';
    const conversationModel = tenant?.ai?.conversation_model || 'gemini-2.5-flash';

    const state: TaskState = {
      id: taskId,
      input,
      status: 'received',
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log(`[task-executor] Task ${taskId}: ${input.task_type} → ${input.target_number}`);

    // ═══ STAGE 1: PARSE & VALIDATE ═══
    state.status = 'validating';
    state.parsed = await this.questionBook.parse(input, tenantId);
    state.validation = await this.questionBook.validate(state.parsed);

    console.log(`[task-executor] Validation: ${state.validation.status} (${state.validation.issues.length} issues)`);

    if (state.validation.status === 'blocked') {
      state.status = 'escalated';
      state.escalation = {
        task_id: taskId,
        target_number: input.target_number,
        situation: 'Task tidak bisa dieksekusi',
        needed_from_owner: state.validation.issues.map((i) => i.issue).join('; '),
        options: ['Perbaiki data dan kirim ulang', 'Batalkan task'],
      };
      await this.persistState(state);
      await this.reportToOwner(state, tenantId);
      return state;
    }

    if (state.validation.status === 'needs_clarification') {
      state.status = 'needs_clarification';
      state.clarification = await this.questionBook.generateClarification(
        taskId,
        state.parsed,
        state.validation,
        classifierModel
      );
      await this.persistState(state);
      await this.reportClarificationToOwner(state, tenantId);
      return state;
    }

    // ═══ STAGE 2: REASONING & STRATEGY ═══
    state.status = 'reasoning';
    const targetProfile = await this.intel.gather(state.parsed.target_number, tenantId);
    state.reasoning = await this.reason(state.parsed, targetProfile, classifierModel);

    console.log(`[task-executor] Reasoning: approach=${state.reasoning.approach}, hook="${state.reasoning.hook.substring(0, 50)}..."`);

    // ═══ STAGE 3: DRAFT & SELF-CHECK ═══
    state.status = 'drafting';
    state.draft = await this.draft(state.parsed, state.reasoning, targetProfile, conversationModel);

    if (!state.draft.self_check.passed) {
      console.warn(`[task-executor] Self-check FAILED — attempting redraft`);
      state.draft = await this.draft(state.parsed, state.reasoning, targetProfile, conversationModel);

      if (!state.draft.self_check.passed) {
        state.status = 'escalated';
        state.escalation = {
          task_id: taskId,
          target_number: input.target_number,
          situation: 'Pesan tidak lolos self-check setelah 2x percobaan',
          needed_from_owner: state.draft.self_check.checks
            .filter((c) => !c.passed)
            .map((c) => c.detail || c.rule)
            .join('; '),
          options: ['Override — kirim pesan apa adanya', 'Tulis pesan manual', 'Batalkan'],
        };
        await this.persistState(state);
        await this.reportToOwner(state, tenantId);
        return state;
      }
    }

    // ═══ STAGE 4: EXECUTE ═══
    state.status = 'executing';
    const sent = await this.send(state.parsed.target_number, state.draft.parts);

    if (!sent) {
      state.status = 'failed';
      state.report = {
        task_id: taskId,
        task_type: input.task_type,
        target_number: input.target_number,
        target_name: state.parsed.contact_name,
        status: 'failed',
        messages_sent: [],
        next_action: 'Coba lagi atau hubungi manual',
        reasoning_summary: state.reasoning.real_objective,
      };
      await this.persistState(state);
      await this.reportToOwner(state, tenantId);
      return state;
    }

    // ═══ STAGE 5: TRACKING & REPORT ═══
    state.status = 'sent';
    state.report = {
      task_id: taskId,
      task_type: input.task_type,
      target_number: input.target_number,
      target_name: state.parsed.contact_name,
      status: 'sent',
      messages_sent: state.draft.parts.map((p) => p.content),
      sent_at: new Date(),
      initial_score: 0,
      current_phase: 'kenalan',
      next_action: this.determineNextAction(input.task_type),
      reasoning_summary: state.reasoning.real_objective,
    };

    // Create or update conversation in store
    await this.createConversationFromTask(state, tenantId);
    await this.persistState(state);
    await this.reportToOwner(state, tenantId);

    console.log(`[task-executor] Task ${taskId} COMPLETED — ${state.draft.parts.length} messages sent`);
    return state;
  }

  /**
   * Resume a task that was paused at needs_clarification.
   */
  async resume(taskId: string, ownerResponse: string): Promise<TaskState> {
    const state = await this.loadState(taskId);
    if (!state) throw new Error(`Task ${taskId} not found`);
    if (state.status !== 'needs_clarification') {
      throw new Error(`Task ${taskId} is not waiting for clarification (status: ${state.status})`);
    }

    // Add owner's response as context_extra
    if (state.parsed) {
      state.parsed.context_extra = (state.parsed.context_extra || '') + '\n[Owner clarification]: ' + ownerResponse;
    }

    // Re-validate with additional context
    state.status = 'validating';
    if (state.parsed) {
      state.validation = await this.questionBook.validate(state.parsed);
    }

    // If still blocked, escalate
    if (state.validation && state.validation.status === 'blocked') {
      state.status = 'escalated';
      return state;
    }

    // Continue from stage 2
    return this.continueFromReasoning(state);
  }

  // ═══════════════════════════════════════
  // STAGE 2: REASONING
  // ═══════════════════════════════════════

  /**
   * Determine customer engagement level.
   * For FIRST CONTACT (no prior conversation), ALWAYS start as Cold regardless of hunter score.
   * Hunter pain_score only affects PRIORITY of who to contact, not HOW to talk.
   */
  private determineEngagementLevel(
    task: import('./types.js').ParsedTask,
    profile: TargetProfile
  ): CustomerEngagementLevel {
    // First contact = always cold. Build rapport first.
    if (!task.contact_history) return 'cold';

    const score = task.contact_history.last_score;
    if (score >= 70) return 'hot';
    if (score >= 50) return 'warm';
    if (score >= 30) return 'lukewarm';
    return 'cold';
  }

  /**
   * Suggest how many messages are appropriate based on context.
   */
  private suggestMessageCount(
    task: import('./types.js').ParsedTask,
    engagementLevel: CustomerEngagementLevel
  ): number {
    // First contact / greetings: keep it short
    if (!task.contact_history || task.task_type === 'outreach') {
      return engagementLevel === 'cold' ? 1 : 2;
    }
    // Follow-ups: moderate
    if (task.task_type === 'follow_up') return 2;
    // Rescue: brief and respectful
    if (task.task_type === 'rescue') return 2;
    // Qualification with warm/hot: can be more detailed
    if (engagementLevel === 'warm' || engagementLevel === 'hot') return 4;
    // Default moderate
    return 3;
  }

  private async reason(
    task: import('./types.js').ParsedTask,
    profile: TargetProfile,
    model: string
  ): Promise<TaskReasoning> {
    // Determine approach based on available data
    let approach: TaskReasoning['approach'] = 'curiosity_based';
    if (task.task_type === 'follow_up') approach = 'follow_up';
    else if (task.task_type === 'rescue') approach = 'rescue';
    else if (profile.data_completeness >= 40 && profile.pain_points.length > 0) approach = 'pain_based';

    // Issue 2: Determine engagement level based on conversation history, NOT hunter data
    const engagementLevel = this.determineEngagementLevel(task, profile);
    const messageCountGuidance = this.suggestMessageCount(task, engagementLevel);

    try {
      const gemini = getModel(model, { temperature: 0.2, maxOutputTokens: 512 });

      const result = await gemini.generateContent({
        systemInstruction: `Kamu adalah strategi planner untuk Mandala sales agent. Jawab 6 pertanyaan pre-eksekusi. Output JSON ONLY.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Task: ${task.task_type}
Objective: ${task.objective_raw}
Target: ${task.target_number}
${task.contact_name ? `Nama: ${task.contact_name}` : ''}
${task.contact_history ? `Riwayat: fase ${task.contact_history.last_phase}, ${task.contact_history.total_messages} pesan, skor ${task.contact_history.last_score}` : 'Kontak baru — FIRST CONTACT'}
${task.context_extra ? `Konteks: ${task.context_extra}` : ''}

Data yang tersedia tentang target:
- Source: ${profile.source}
- Bisnis: ${profile.business_name || 'tidak diketahui'}
- Tipe: ${profile.business_type || 'tidak diketahui'}
- Pain points: ${profile.pain_points.length > 0 ? profile.pain_points.join(', ') : 'tidak ada data'}
- Data completeness: ${profile.data_completeness}%
- Engagement level: ${engagementLevel}

Jawab 6 pertanyaan wajib:
Q1: Apa outcome nyata yang Owner inginkan?
Q2: Siapa target ini (estimasi profil)?
Q3: Hook apa yang relevan untuk mereka?
Q4: Strategi apa yang paling tepat?
Q5: Metric sukses yang realistis?
Q6: Apa estimasi engagement level customer (cold/lukewarm/warm/hot) dan pendekatan apa yang cocok?

Output JSON:
{
  "real_objective": "outcome nyata (bukan literal objective)",
  "hook": "angle pembuka pesan yang spesifik",
  "success_metric": 1-5,
  "reasoning_notes": "ringkasan Q1-Q6 dalam 2 kalimat",
  "suggested_message_count": ${messageCountGuidance}
}`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          real_objective: parsed.real_objective || task.objective_raw,
          target_profile: profile,
          hook: parsed.hook || this.defaultHook(approach),
          strategy: task.task_type,
          success_metric: Math.min(5, Math.max(1, parsed.success_metric || 3)) as TaskReasoning['success_metric'],
          approach,
          messageCountGuidance: parsed.suggested_message_count || messageCountGuidance,
          engagementLevel,
        };
      }
    } catch (err) {
      console.error('[task-executor] Reasoning error:', err);
    }

    // Fallback reasoning
    return {
      real_objective: task.objective_raw,
      target_profile: profile,
      hook: this.defaultHook(approach),
      strategy: task.task_type,
      success_metric: 3,
      approach,
      messageCountGuidance,
      engagementLevel,
    };
  }

  // ═══════════════════════════════════════
  // STAGE 3: DRAFT & SELF-CHECK
  // ═══════════════════════════════════════

  /**
   * Get engagement-level-aware messaging instructions.
   * Cold: be a friend. Lukewarm: share stories. Warm: introduce product. Hot: direct pitch.
   */
  private getEngagementLevelInstructions(level: CustomerEngagementLevel): string {
    switch (level) {
      case 'cold':
        return `LEVEL CUSTOMER: COLD (Belum kenal)
PENDEKATAN: Jadilah TEMAN dulu, BUKAN sales. Tanya tentang BISNIS MEREKA, masalah mereka, kehidupan sehari-hari.
JANGAN sebut produk sama sekali. Goal: bangun rapport dan kumpulkan info.
Kamu adalah teman ngobrol, BUKAN sales. Jualan hanya saat customer sudah di level tinggi.`;
      case 'lukewarm':
        return `LEVEL CUSTOMER: LUKEWARM (Sudah sedikit kenal)
PENDEKATAN: Share cerita/masalah yang relatable. Boleh singgung solusi secara UMUM (bukan produk spesifik).
Goal: buat mereka penasaran. Masih fokus ke mereka, bukan ke kamu.`;
      case 'warm':
        return `LEVEL CUSTOMER: WARM (Sudah terbuka)
PENDEKATAN: Perkenalkan produkmu sebagai solusi NATURAL dari masalah yang sudah mereka ceritakan.
Hubungkan pain points mereka dengan solusi. Goal: tumbuhkan interest.`;
      case 'hot':
        return `LEVEL CUSTOMER: HOT (Sangat tertarik)
PENDEKATAN: Direct pitch boleh. Bahas pricing, CTA jelas, arahkan ke next step.
Goal: closing atau schedule meeting.`;
    }
  }

  /**
   * Get dynamic message count instruction based on context.
   */
  private getMessageCountInstruction(guidance: number, level: CustomerEngagementLevel): string {
    if (level === 'cold' && guidance <= 2) {
      return `JUMLAH PESAN: Kirim ${guidance} pesan saja. Untuk sapaan pertama, cukup 1-2 bubble pendek. Jangan overload.`;
    }
    if (guidance <= 2) {
      return `JUMLAH PESAN: Kirim sekitar ${guidance} pesan. Singkat dan to the point.`;
    }
    if (guidance <= 4) {
      return `JUMLAH PESAN: Kirim sekitar ${guidance} pesan. Cukup detail tapi jangan bertele-tele.`;
    }
    return `JUMLAH PESAN: Kirim ${guidance}-${guidance + 2} pesan. Boleh detail karena konteksnya butuh penjelasan.`;
  }

  private async draft(
    task: import('./types.js').ParsedTask,
    reasoning: TaskReasoning,
    profile: TargetProfile,
    model: string
  ): Promise<DraftedMessage> {
    const gemini = getModel(model, { temperature: 0.7, maxOutputTokens: 400 });

    const structureGuide = this.getStructureGuide(task.task_type);
    const dataWarning = profile.data_completeness < 30
      ? '\n\nPERINGATAN: Data sangat terbatas. Jangan sebut detail bisnis yang tidak ada. Gunakan pendekatan umum.'
      : '';

    // Issue 2: Customer-level-aware instructions
    const engagementInstructions = this.getEngagementLevelInstructions(reasoning.engagementLevel);

    // Issue 1: Dynamic message count guidance
    const messageCountInstr = this.getMessageCountInstruction(reasoning.messageCountGuidance, reasoning.engagementLevel);

    // Build available/missing data lists for anti-hallucination
    const availableData: string[] = [];
    const missingData: string[] = [];
    if (profile.business_name) availableData.push(`bisnis: ${profile.business_name}`);
    else missingData.push('nama bisnis');
    if (profile.business_type) availableData.push(`tipe: ${profile.business_type}`);
    else missingData.push('tipe bisnis');
    if (profile.pain_points.length > 0) availableData.push(`pain points: ${profile.pain_points.join(', ')}`);
    else missingData.push('pain points');

    try {
      const result = await gemini.generateContent({
        systemInstruction: `Kamu adalah Mandala, asisten percakapan dari Jadisatu. Buat pesan WhatsApp sesuai konteks.

Kamu adalah teman ngobrol, BUKAN sales. Jualan hanya saat customer sudah di level tinggi.
Gunakan skills sebagai panduan, bukan skrip. Adaptasi berdasarkan konteks percakapan.

${engagementInstructions}

${messageCountInstr}

ATURAN PESAN:
- Bahasa Indonesia casual tapi sopan
- PENDEK — setiap bagian max 2-3 kalimat
- Pisahkan pesan dengan ||| (untuk split jadi beberapa bubble WA)
- Jumlah bubble harus sesuai konteks (JANGAN selalu 3)
- Jangan sebut harga (kecuali customer level HOT)
- Jangan pakai numbered list
- Jangan pakai kata: "penawaran", "promo", "diskon", "solusi terbaik"
- Terasa seperti dari manusia, bukan template
- Ada 1 CTA yang jelas (boleh berupa pertanyaan casual)

ANTI-HALLUCINATION (WAJIB):
- HANYA referensikan fakta dari data yang tersedia
- JANGAN asumsikan atau karang detail yang tidak ada
- Jika data terbatas, gunakan pendekatan umum${dataWarning}`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Target: ${task.target_number}
${task.contact_name ? `Nama: ${task.contact_name}` : ''}
Objective: ${reasoning.real_objective}
Approach: ${reasoning.approach}
Engagement Level: ${reasoning.engagementLevel}
Hook: ${reasoning.hook}

DATA YANG TERSEDIA: ${availableData.length > 0 ? availableData.join(', ') : 'sangat terbatas'}
DATA YANG TIDAK TERSEDIA (JANGAN sebut): ${missingData.length > 0 ? missingData.join(', ') : 'semua tersedia'}

Struktur panduan (adaptasi sesuai konteks):
${structureGuide}

Buat pesan (pisahkan dengan |||, jumlah bubble sesuai konteks — bisa 1, 2, 3, atau lebih):`,
          }],
        }],
      });

      const text = result.response.text().trim();
      const rawParts = text.split('|||').map((p) => p.trim()).filter(Boolean);

      // Issue 4: Natural typing delays between messages (1-4 seconds, varied)
      const parts: MessagePart[] = rawParts.map((content, i) => ({
        content,
        delay_seconds: i === 0 ? 0 : 1 + Math.random() * 3, // 1-4 second natural typing delay
      }));

      // Self-check
      const selfCheck = this.selfCheck(parts, task, profile, reasoning);

      return { parts, self_check: selfCheck };
    } catch (err) {
      console.error('[task-executor] Draft error:', err);
      return {
        parts: [],
        self_check: { passed: false, checks: [{ rule: 'generation', passed: false, detail: 'AI generation failed' }] },
      };
    }
  }

  /**
   * Self-check per protocol section 4.2.
   * Issue 1: Relaxed message count — validated against context, not fixed at 3.
   * Issue 2: Price check now considers engagement level.
   */
  private selfCheck(
    parts: MessagePart[],
    task: import('./types.js').ParsedTask,
    profile: TargetProfile,
    reasoning?: TaskReasoning
  ): SelfCheckResult {
    const fullMessage = parts.map((p) => p.content).join(' ');
    const lower = fullMessage.toLowerCase();
    const checks: SelfCheckItem[] = [];
    const engagementLevel = reasoning?.engagementLevel || 'cold';

    // No price unless hot engagement or rescue
    const hasPrice = /\d+\s*(jt|juta|rb|ribu|k)\b|rp\s*\.?\d/i.test(fullMessage);
    checks.push({
      rule: 'no_price',
      passed: !hasPrice || task.task_type === 'rescue' || engagementLevel === 'hot',
      detail: hasPrice ? 'Pesan mengandung harga' : undefined,
    });

    // No numbered lists
    const hasNumberedList = /^\d+\.\s/m.test(fullMessage);
    checks.push({
      rule: 'no_numbered_list',
      passed: !hasNumberedList,
      detail: hasNumberedList ? 'Mengandung numbered list' : undefined,
    });

    // No forbidden words (relax for hot customers)
    const forbiddenWords = engagementLevel === 'hot'
      ? ['promo', 'diskon'] // hot customers: only block discount language
      : ['penawaran', 'promo', 'diskon', 'solusi terbaik'];
    const foundForbidden = forbiddenWords.filter((w) => lower.includes(w));
    checks.push({
      rule: 'no_forbidden_words',
      passed: foundForbidden.length === 0,
      detail: foundForbidden.length > 0 ? `Kata terlarang: ${foundForbidden.join(', ')}` : undefined,
    });

    // No internal metadata leaked
    const hasMetadata = /\{.*"intent"|confidence|score_delta|\[META\]/i.test(fullMessage);
    checks.push({
      rule: 'no_metadata_leak',
      passed: !hasMetadata,
      detail: hasMetadata ? 'Metadata internal bocor ke pesan' : undefined,
    });

    // Message count should match context complexity (not fixed "max 3 paragraphs")
    const maxPartsForContext = reasoning?.messageCountGuidance
      ? reasoning.messageCountGuidance + 3 // allow some flexibility above guidance
      : 8; // generous fallback
    const maxParagraphsPerPart = 4; // per individual bubble
    const tooManyParts = parts.length > maxPartsForContext;
    const tooLongPart = parts.some((p) => p.content.split('\n\n').length > maxParagraphsPerPart);
    checks.push({
      rule: 'message_count_matches_context',
      passed: !tooManyParts && !tooLongPart,
      detail: tooManyParts
        ? `Terlalu banyak bubble (${parts.length}) untuk konteks ini (max ~${maxPartsForContext})`
        : tooLongPart
        ? `Ada bubble yang terlalu panjang (>4 paragraf per bubble)`
        : undefined,
    });

    // Has a CTA (question or call to action)
    const hasCTA = /\?|boleh|bisa|mau|yuk|coba|gimana/i.test(fullMessage);
    checks.push({
      rule: 'has_cta',
      passed: hasCTA,
      detail: !hasCTA ? 'Tidak ada CTA / pertanyaan' : undefined,
    });

    // Anti-hallucination: check for social media claims without data
    if (profile.data_completeness < 30) {
      const socialPlatforms = ['instagram', 'ig', 'tiktok', 'facebook', 'fb', 'twitter', 'youtube', 'linkedin'];
      const mentionedSocial = socialPlatforms.filter((p) => lower.includes(p));
      checks.push({
        rule: 'no_hallucinated_social',
        passed: mentionedSocial.length === 0,
        detail: mentionedSocial.length > 0 ? `Menyebut ${mentionedSocial.join(', ')} tanpa data` : undefined,
      });
    }

    // Cold engagement should NOT mention product
    if (engagementLevel === 'cold') {
      const productMentions = ['jadisatu', 'platform kami', 'produk kami', 'layanan kami', 'jasa kami'];
      const foundProduct = productMentions.filter((w) => lower.includes(w));
      checks.push({
        rule: 'cold_no_product_mention',
        passed: foundProduct.length === 0,
        detail: foundProduct.length > 0 ? `Cold customer: jangan sebut produk (${foundProduct.join(', ')})` : undefined,
      });
    }

    // Not empty
    checks.push({
      rule: 'not_empty',
      passed: parts.length > 0 && parts[0].content.length > 0,
      detail: parts.length === 0 ? 'Pesan kosong' : undefined,
    });

    const passed = checks.every((c) => c.passed);
    return { passed, checks };
  }

  // ═══════════════════════════════════════
  // STAGE 4: SEND
  // ═══════════════════════════════════════

  /**
   * Issue 4: Restructured timing for natural behavior.
   * 1. Pre-read delay: 5-30s (simulates "not staring at phone")
   * 2. Mark as read
   * 3. Typing delay: 1-3s (quick typing after reading)
   * 4. Send first message
   * 5. Between messages: 1-4s (natural typing speed, varied)
   */
  private async send(targetNumber: string, parts: MessagePart[]): Promise<boolean> {
    try {
      // Step 1: Pre-read delay — simulate not staring at phone
      const preReadDelay = naturalDelay(5, 30);
      console.log(`[task-executor] Pre-read delay: ${(preReadDelay / 1000).toFixed(1)}s for ${targetNumber}`);
      await this.sleep(preReadDelay);

      // Step 2: Mark as read (if adapter supports it)
      await this.wa.markAsRead(targetNumber);
      console.log(`[task-executor] Marked as read for ${targetNumber}`);

      // Step 3: Short typing delay before first message
      const typingDelay = naturalDelay(1, 3);
      await this.sleep(typingDelay);

      // Step 4-5: Send messages with natural between-message delays
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // Between-message delay: 1-4 seconds (varied natural typing)
          const betweenDelay = naturalDelay(1, 4);
          await this.sleep(betweenDelay);
        }
        const sent = await this.wa.send(targetNumber, parts[i].content);
        if (!sent) {
          console.error(`[task-executor] Failed to send part ${i + 1} to ${targetNumber}`);
          return false;
        }
        console.log(`[task-executor] Sent part ${i + 1}/${parts.length} to ${targetNumber}`);
      }
      return true;
    } catch (err) {
      console.error('[task-executor] Send error:', err);
      return false;
    }
  }

  // ═══════════════════════════════════════
  // STAGE 5: REPORTING
  // ═══════════════════════════════════════

  private async reportToOwner(state: TaskState, tenantId: string): Promise<void> {
    const tenant = this.tenantManager.get(tenantId);
    const ownerNumber = tenant?.owner?.whatsapp;
    if (!ownerNumber) return;

    let reportMsg: string;

    if (state.status === 'sent' && state.report) {
      const messagePreview = state.report.messages_sent
        .map((m, i) => `${i + 1}. "${m.substring(0, 80)}${m.length > 80 ? '...' : ''}"`)
        .join('\n');

      reportMsg = `[MANDALA TASK REPORT]\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Task: ${state.report.task_type}\n` +
        `Target: ${state.report.target_number}${state.report.target_name ? ` (${state.report.target_name})` : ''}\n` +
        `Status: TERKIRIM\n\n` +
        `Pesan:\n${messagePreview}\n\n` +
        `Next: ${state.report.next_action}\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    } else if (state.status === 'escalated' && state.escalation) {
      reportMsg = `[MANDALA ESKALASI]\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `Target: ${state.escalation.target_number}\n` +
        `Situasi: ${state.escalation.situation}\n` +
        `Yang dibutuhkan: ${state.escalation.needed_from_owner}\n` +
        `Opsi:\n${state.escalation.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}\n` +
        `━━━━━━━━━━━━━━━━━`;
    } else if (state.status === 'failed') {
      reportMsg = `[MANDALA] Task GAGAL ke ${state.input.target_number}. Pesan tidak terkirim.`;
    } else {
      return;
    }

    try {
      await this.wa.send(ownerNumber, reportMsg);
    } catch (err) {
      console.error('[task-executor] Failed to report to owner:', err);
    }
  }

  private async reportClarificationToOwner(state: TaskState, tenantId: string): Promise<void> {
    const tenant = this.tenantManager.get(tenantId);
    const ownerNumber = tenant?.owner?.whatsapp;
    if (!ownerNumber || !state.clarification) return;

    const msg = `[MANDALA]\n` +
      `Sebelum saya hubungi ${state.clarification.target}, saya butuh satu klarifikasi:\n\n` +
      `${state.clarification.question}\n\n` +
      state.clarification.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n') +
      (state.clarification.context ? `\n\n${state.clarification.context}` : '');

    try {
      await this.wa.send(ownerNumber, msg);
    } catch (err) {
      console.error('[task-executor] Failed to send clarification to owner:', err);
    }
  }

  // ═══════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════

  private getStructureGuide(taskType: string): string {
    switch (taskType) {
      case 'outreach':
        return `[Buka] Identifikasi diri singkat (1 kalimat)
[Hook] Temuan atau pain point relevan (1-2 kalimat)
[CTA] Tawaran micro-commitment berisiko rendah (1 kalimat)`;
      case 'follow_up':
        return `[Acknowledge] Akui jeda waktu dengan natural
[Update] Berikan sesuatu yang baru/berbeda dari sebelumnya
[Re-open] Buka undangan untuk lanjut tanpa pressure`;
      case 'rescue':
        return `[Validasi] Akui keberatan mereka tanpa defensif
[Pivot] Stop jualan total, tawarkan audit gratis 15 menit
[Low-barrier] Perjelas "gratis, no commitment"`;
      case 'qualification':
        return `[Konteks] Kenapa menghubungi (brief)
[Pertanyaan] 1 pertanyaan terbuka yang natural
[Interest] Tunjukkan genuinely ingin membantu`;
      default:
        return `Buat pesan singkat, natural, ada CTA`;
    }
  }

  private defaultHook(approach: string): string {
    switch (approach) {
      case 'pain_based':
        return 'Gunakan pain point spesifik dari data';
      case 'curiosity_based':
        return 'Tanya tentang bisnis mereka, jangan pretend sudah tau';
      case 'follow_up':
        return 'Acknowledge jeda waktu, berikan update baru';
      case 'rescue':
        return 'Akui keberatan, tawarkan audit gratis';
      default:
        return 'Pendekatan natural — tanya tentang bisnis mereka';
    }
  }

  private determineNextAction(taskType: string): string {
    switch (taskType) {
      case 'outreach':
        return 'Follow-up dalam 3 hari jika tidak ada respons';
      case 'follow_up':
        return 'Tunggu respons 24 jam, lalu escalate jika masih silence';
      case 'rescue':
        return 'Tunggu respons 48 jam, jangan follow-up lagi tanpa persetujuan Owner';
      case 'qualification':
        return 'Tunggu respons, lanjut kualifikasi berdasarkan balasan';
      default:
        return 'Tunggu respons';
    }
  }

  private async continueFromReasoning(state: TaskState): Promise<TaskState> {
    // Re-run from stage 2 onwards with the updated parsed task
    if (!state.parsed) throw new Error('No parsed task');

    const tenantId = state.parsed.tenant_id;
    const tenant = this.tenantManager.get(tenantId);
    const classifierModel = tenant?.ai?.classifier_model || 'gemini-2.0-flash';
    const conversationModel = tenant?.ai?.conversation_model || 'gemini-2.5-flash';

    // Stage 2
    state.status = 'reasoning';
    const profile = await this.intel.gather(state.parsed.target_number, tenantId);
    state.reasoning = await this.reason(state.parsed, profile, classifierModel);

    // Stage 3
    state.status = 'drafting';
    state.draft = await this.draft(state.parsed, state.reasoning, profile, conversationModel);

    if (!state.draft.self_check.passed) {
      state.status = 'escalated';
      await this.persistState(state);
      return state;
    }

    // Stage 4
    state.status = 'executing';
    const sent = await this.send(state.parsed.target_number, state.draft.parts);

    if (!sent) {
      state.status = 'failed';
      await this.persistState(state);
      return state;
    }

    // Stage 5
    state.status = 'sent';
    state.report = {
      task_id: state.id,
      task_type: state.input.task_type,
      target_number: state.input.target_number,
      target_name: state.parsed.contact_name,
      status: 'sent',
      messages_sent: state.draft.parts.map((p) => p.content),
      sent_at: new Date(),
      next_action: this.determineNextAction(state.input.task_type),
      reasoning_summary: state.reasoning.real_objective,
    };

    await this.createConversationFromTask(state, tenantId);
    await this.persistState(state);
    await this.reportToOwner(state, tenantId);

    return state;
  }

  private async createConversationFromTask(state: TaskState, tenantId: string): Promise<void> {
    if (!state.parsed || !state.draft) return;

    try {
      let conversation = await this.store.getByCustomer(tenantId, state.parsed.target_number);
      if (!conversation) {
        conversation = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          customer_number: state.parsed.target_number,
          customer_name: state.parsed.contact_name,
          status: 'active',
          current_handler: 'mandala',
          mode: 'sales-shadow',
          phase: 'kenalan',
          lead_score: 0,
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
          last_message_at: new Date(),
        };
        await this.store.set(conversation);
      }

      // Add sent messages to conversation
      for (const part of state.draft.parts) {
        const msg = {
          id: crypto.randomUUID(),
          conversation_id: conversation.id,
          tenant_id: tenantId,
          direction: 'outgoing' as const,
          sender: 'mandala' as const,
          sender_number: 'mandala',
          content: part.content,
          timestamp: new Date(),
          metadata: { task_id: state.id, task_type: state.input.task_type },
        };
        await this.store.addMessage(conversation.id, msg);
      }
    } catch (err) {
      console.error('[task-executor] Error creating conversation:', err);
    }
  }

  private async persistState(state: TaskState): Promise<void> {
    state.updated_at = new Date();
    try {
      const db = getSupabase();
      await db.from('mandala_task_states').upsert({
        id: state.id,
        tenant_id: state.parsed?.tenant_id || state.input.tenant_id || 'mandala',
        input: state.input,
        status: state.status,
        parsed: state.parsed,
        validation: state.validation,
        clarification: state.clarification,
        reasoning: state.reasoning,
        draft: state.draft,
        report: state.report,
        escalation: state.escalation,
        created_at: state.created_at.toISOString(),
        updated_at: state.updated_at.toISOString(),
      }, { onConflict: 'id' });
    } catch (err) {
      console.error('[task-executor] Error persisting state:', err);
    }
  }

  private async loadState(taskId: string): Promise<TaskState | null> {
    try {
      const db = getSupabase();
      const { data } = await db
        .from('mandala_task_states')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!data) return null;

      return {
        id: data.id,
        input: data.input,
        status: data.status,
        parsed: data.parsed,
        validation: data.validation,
        clarification: data.clarification,
        reasoning: data.reasoning,
        draft: data.draft,
        report: data.report,
        escalation: data.escalation,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Generate a human-like random delay in milliseconds.
 * Uses slight gaussian-like distribution (sum of 2 randoms) for more natural feel.
 */
export function naturalDelay(minSeconds: number, maxSeconds: number): number {
  // Average of two random values gives a slight bell-curve distribution
  const r = (Math.random() + Math.random()) / 2;
  const seconds = minSeconds + r * (maxSeconds - minSeconds);
  return Math.round(seconds * 1000);
}
