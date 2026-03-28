import { getModel } from '../ai/gemini-client.js';
import type {
  TaskInput,
  ParsedTask,
  ValidationResult,
  ValidationIssue,
  ClarificationRequest,
  ContactHistory,
} from './types.js';
import { TargetIntel } from './target-intel.js';
import { ConversationStore } from '../memory/conversation-store.js';

/**
 * Question Book — Tahap 1 of the Mandala Task Execution Protocol.
 *
 * When a task arrives, it:
 * 1. Parses and extracts the 6 core variables
 * 2. Validates the task for completeness
 * 3. Checks contact history (has this number been contacted before?)
 * 4. If ambiguous or incomplete, generates clarifying questions for the owner
 * 5. Only passes through tasks that are ready for execution
 */
export class QuestionBook {
  private static instance: QuestionBook;
  private store = ConversationStore.getInstance();
  private intel = TargetIntel.getInstance();

  static getInstance(): QuestionBook {
    if (!QuestionBook.instance) {
      QuestionBook.instance = new QuestionBook();
    }
    return QuestionBook.instance;
  }

  /**
   * Parse raw task input into a structured ParsedTask.
   * Extracts the 6 required variables per protocol section 2.1.
   */
  async parse(input: TaskInput, tenantId: string): Promise<ParsedTask> {
    const normalizedNumber = this.normalizePhoneNumber(input.target_number);

    // Check contact history
    const history = await this.getContactHistory(tenantId, normalizedNumber);

    return {
      task_type: input.task_type,
      target_number: normalizedNumber,
      objective_raw: input.objective_raw,
      context_extra: input.context_extra,
      contact_history: history,
      contact_name: input.contact_name,
      tenant_id: tenantId,
    };
  }

  /**
   * Validate the parsed task per protocol section 2.2.
   * Returns issues that block execution or need clarification.
   */
  async validate(task: ParsedTask): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Check: valid phone number
    if (!this.isValidPhoneNumber(task.target_number)) {
      issues.push({
        field: 'target_number',
        issue: 'Nomor tidak valid — format harus 62xxx (Indonesia)',
        severity: 'blocker',
      });
    }

    // Check: objective not empty
    if (!task.objective_raw || task.objective_raw.trim().length < 5) {
      issues.push({
        field: 'objective_raw',
        issue: 'Objective terlalu singkat atau kosong',
        severity: 'blocker',
      });
    }

    // Check: objective ambiguity
    const ambiguityIssues = this.detectAmbiguity(task);
    issues.push(...ambiguityIssues);

    // Check: previously rejected
    if (task.contact_history?.was_rejected) {
      issues.push({
        field: 'contact_history',
        issue: `Nomor ini sudah pernah menolak tegas (terakhir: ${task.contact_history.last_message_at.toISOString().split('T')[0]})`,
        severity: 'blocker',
      });
    }

    // Check: task type mismatch with history
    if (task.task_type === 'outreach' && task.contact_history && task.contact_history.total_messages > 0) {
      issues.push({
        field: 'task_type',
        issue: `Tipe "outreach" tapi nomor ini sudah pernah dihubungi (${task.contact_history.total_messages} pesan, fase: ${task.contact_history.last_phase}). Mungkin seharusnya follow_up?`,
        severity: 'warning',
      });
    }

    // Check: follow_up without history
    if (task.task_type === 'follow_up' && !task.contact_history) {
      issues.push({
        field: 'task_type',
        issue: 'Tipe "follow_up" tapi tidak ada riwayat kontak sebelumnya',
        severity: 'warning',
      });
    }

    // Check: rescue without existing conversation
    if (task.task_type === 'rescue' && !task.contact_history) {
      issues.push({
        field: 'task_type',
        issue: 'Tipe "rescue" tapi tidak ada percakapan yang bisa di-rescue',
        severity: 'blocker',
      });
    }

    // Determine overall status
    const hasBlockers = issues.some((i) => i.severity === 'blocker');
    const hasWarnings = issues.some((i) => i.severity === 'warning');

    return {
      valid: !hasBlockers,
      status: hasBlockers ? 'blocked' : hasWarnings ? 'needs_clarification' : 'ready',
      issues,
    };
  }

  /**
   * Generate a clarification request for the owner when the task is ambiguous.
   * Per protocol section 7.2.
   */
  async generateClarification(
    taskId: string,
    task: ParsedTask,
    validation: ValidationResult,
    classifierModel: string
  ): Promise<ClarificationRequest> {
    const issuesSummary = validation.issues
      .filter((i) => i.severity !== 'info')
      .map((i) => `- ${i.issue}`)
      .join('\n');

    try {
      const model = getModel(classifierModel, {
        temperature: 0.3,
        maxOutputTokens: 300,
      });

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah Mandala, asisten bisnis. Buat pertanyaan klarifikasi singkat ke Owner sebelum eksekusi task.
Format output JSON:
{
  "question": "1 pertanyaan spesifik yang paling penting",
  "options": ["opsi A", "opsi B", "opsi C (opsional)"],
  "context": "1 kalimat kenapa ini penting"
}
Bahasa Indonesia, singkat, to the point.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Task: ${task.task_type} ke ${task.target_number}
Objective: ${task.objective_raw}
${task.contact_name ? `Nama: ${task.contact_name}` : 'Nama: tidak diketahui'}
${task.contact_history ? `Riwayat: ${task.contact_history.total_messages} pesan, fase ${task.contact_history.last_phase}` : 'Riwayat: kontak baru'}
${task.context_extra ? `Konteks: ${task.context_extra}` : ''}

Masalah yang ditemukan:
${issuesSummary}

Buat pertanyaan klarifikasi:`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          task_id: taskId,
          target: task.target_number,
          question: parsed.question || 'Bisa berikan konteks lebih lanjut?',
          options: parsed.options || ['Lanjutkan saja', 'Batalkan task'],
          context: parsed.context || '',
        };
      }
    } catch (err) {
      console.error('[question-book] Error generating clarification:', err);
    }

    // Fallback: use the first non-info issue as the question
    const primaryIssue = validation.issues.find((i) => i.severity !== 'info');
    return {
      task_id: taskId,
      target: task.target_number,
      question: primaryIssue?.issue || 'Bisa berikan konteks lebih lanjut untuk task ini?',
      options: ['Lanjutkan dengan asumsi default', 'Berikan konteks tambahan', 'Batalkan task'],
      context: `Ditemukan ${validation.issues.length} masalah pada task ini`,
    };
  }

  /**
   * Detect ambiguity in the objective text.
   */
  private detectAmbiguity(task: ParsedTask): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const obj = task.objective_raw.toLowerCase();

    // Too vague — no specific action or product mentioned
    const hasAction = /hubungi|tawarkan|follow.?up|rescue|kualifikasi|jual|promosi|tanya/i.test(obj);
    if (!hasAction) {
      issues.push({
        field: 'objective_raw',
        issue: 'Objective tidak jelas — tidak ada aksi spesifik (hubungi, tawarkan, follow up, dll)',
        severity: 'warning',
      });
    }

    // Multiple conflicting objectives
    const actionCount = (obj.match(/hubungi|tawarkan|jual|promosi|cari|tanya|follow/gi) || []).length;
    if (actionCount >= 3) {
      issues.push({
        field: 'objective_raw',
        issue: 'Objective terlalu banyak aksi sekaligus — Mandala perlu prioritas mana yang utama',
        severity: 'warning',
      });
    }

    // No product/service mentioned for outreach
    if (task.task_type === 'outreach') {
      const hasProduct = /sosmed|sosial media|website|kelola|marketing|design|konten|content|jasa|layanan|produk/i.test(obj);
      if (!hasProduct && !task.context_extra) {
        issues.push({
          field: 'objective_raw',
          issue: 'Outreach tanpa menyebutkan produk/layanan yang ditawarkan',
          severity: 'info',
        });
      }
    }

    return issues;
  }

  /**
   * Look up contact history from conversation store.
   */
  private async getContactHistory(tenantId: string, number: string): Promise<ContactHistory | null> {
    try {
      const conversation = await this.store.getByCustomer(tenantId, number);
      if (!conversation || conversation.messages.length === 0) return null;

      const customerMessages = conversation.messages.filter((m) => m.sender === 'customer');
      const lastCustomerMsg = customerMessages[customerMessages.length - 1];

      // Check for explicit rejection in recent messages
      const recentCustomerMsgs = customerMessages.slice(-5);
      const rejectionPatterns = /tidak tertarik|gak jadi|jangan hubungi|stop|unsubscribe|blokir/i;
      const wasRejected = recentCustomerMsgs.some((m) => rejectionPatterns.test(m.content));

      // Count follow-up attempts (outgoing messages after silence)
      const followUpCount = conversation.messages.filter(
        (m) => m.sender === 'mandala' && m.metadata?.is_follow_up
      ).length;

      return {
        conversation_id: conversation.id,
        last_phase: conversation.phase,
        last_score: conversation.lead_score,
        last_message_at: conversation.last_message_at,
        total_messages: conversation.messages.length,
        was_rejected: wasRejected,
        follow_up_count: followUpCount,
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalize Indonesian phone number to international format (62xxx).
   */
  private normalizePhoneNumber(number: string): string {
    let cleaned = number.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('08')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8') && cleaned.length >= 10) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  }

  private isValidPhoneNumber(number: string): boolean {
    // Indonesian number: 62 + 8-13 digits
    return /^62\d{8,13}$/.test(number);
  }
}
