// ============================================================
// Mandala Task Engine — Task Validator
//
// Checks if a task has enough context to execute. Two layers:
// 1. Rule-based checks (fast, no AI) for common patterns
// 2. AI ambiguity detection (Gemini Flash) for edge cases
// ============================================================

import { getModel } from '../ai/gemini-client.js';
import type { MandalaTask } from './types.js';
import type { ClarificationQuestion } from './types.js';

export interface ValidationResult {
  valid: boolean;
  questions: ClarificationQuestion[];
}

// Keywords that indicate billing/payment tasks
const BILLING_KEYWORDS = ['tagih', 'bayar', 'invoice', 'lunasi', 'pelunasan', 'pembayaran', 'hutang', 'piutang', 'cicilan'];
const MEETING_KEYWORDS = ['meeting', 'jadwal', 'ketemu', 'appointment', 'demo'];

export class TaskValidator {
  private static instance: TaskValidator;

  static getInstance(): TaskValidator {
    if (!TaskValidator.instance) {
      TaskValidator.instance = new TaskValidator();
    }
    return TaskValidator.instance;
  }

  /**
   * Validate a task and return missing info as clarification questions.
   * Returns { valid: true } if the task can proceed as-is.
   */
  async validate(task: MandalaTask): Promise<ValidationResult> {
    const questions: ClarificationQuestion[] = [];

    // Layer 1: Rule-based checks
    this.checkRules(task, questions);

    // If rule-based checks found issues, return early (no AI call needed)
    if (questions.length > 0) {
      return { valid: false, questions };
    }

    // Layer 2: AI ambiguity detection for tasks that pass rule checks
    // Only run for tasks with short/vague objectives
    if (task.objective.length < 100 && !task.context) {
      const aiQuestions = await this.checkWithAI(task);
      if (aiQuestions.length > 0) {
        return { valid: false, questions: aiQuestions };
      }
    }

    return { valid: true, questions: [] };
  }

  private checkRules(task: MandalaTask, questions: ClarificationQuestion[]): void {
    const objectiveLower = task.objective.toLowerCase();
    const contextLower = (task.context || '').toLowerCase();
    const combined = objectiveLower + ' ' + contextLower;

    // Billing/payment tasks need: nominal, deadline, payment destination
    if (BILLING_KEYWORDS.some((kw) => combined.includes(kw))) {
      if (!this.hasInfo(combined, ['nominal', 'jumlah', 'total', 'rp', 'rupiah', 'idr', '\\d+\\.?\\d*'])) {
        questions.push({
          field: 'nominal',
          question: 'Berapa nominal yang harus ditagih?',
          type: 'text',
          required: true,
        });
      }

      if (!this.hasInfo(combined, ['deadline', 'jatuh tempo', 'batas', 'tanggal', 'sebelum'])) {
        questions.push({
          field: 'deadline',
          question: 'Kapan batas waktu pembayaran?',
          type: 'date',
          required: false,
        });
      }

      if (!this.hasInfo(combined, ['rekening', 'transfer', 'bank', 'bca', 'mandiri', 'bni', 'bri', 'dana', 'ovo', 'gopay'])) {
        questions.push({
          field: 'payment_destination',
          question: 'Pembayaran ke mana? (rekening/e-wallet)',
          type: 'text',
          required: true,
        });
      }
    }

    // Meeting/scheduling tasks need: time, location/link
    if (MEETING_KEYWORDS.some((kw) => combined.includes(kw))) {
      if (!this.hasInfo(combined, ['jam', 'pukul', 'waktu', 'tanggal', '\\d{1,2}[:/.]\\d{2}'])) {
        questions.push({
          field: 'schedule',
          question: 'Kapan jadwal meeting-nya?',
          type: 'text',
          required: true,
        });
      }

      if (!this.hasInfo(combined, ['zoom', 'meet', 'link', 'lokasi', 'tempat', 'online', 'offline'])) {
        questions.push({
          field: 'location',
          question: 'Di mana meeting-nya? (link Zoom/Meet atau lokasi)',
          type: 'text',
          required: false,
        });
      }
    }

    // Outreach without any context
    if (task.type === 'outreach' && !task.context && task.objective.length < 50) {
      questions.push({
        field: 'business_context',
        question: 'Bisa ceritakan sedikit tentang bisnis/konteks target? (apa bisnis mereka, dari mana kenal, dll)',
        type: 'text',
        required: false,
      });
    }
  }

  /**
   * Check if the combined text contains any of the indicator patterns.
   */
  private hasInfo(text: string, indicators: string[]): boolean {
    return indicators.some((ind) => new RegExp(ind, 'i').test(text));
  }

  /**
   * Use Gemini Flash for AI-based ambiguity detection.
   * Only called when rule-based checks pass but objective is short/vague.
   */
  private async checkWithAI(task: MandalaTask): Promise<ClarificationQuestion[]> {
    try {
      const model = getModel('gemini-2.0-flash', {
        temperature: 0,
        maxOutputTokens: 512,
      });

      const result = await model.generateContent({
        systemInstruction: `You analyze task objectives for a WhatsApp sales agent. Determine if the task has enough information to execute well. Output JSON ONLY.`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Task type: ${task.type}
Objective: ${task.objective}
Context: ${task.context || '(none)'}

Does this task have enough info to execute? If NOT, what's missing?
Respond with JSON:
{
  "has_enough_info": true/false,
  "missing": [
    { "field": "field_name", "question": "Question in Bahasa Indonesia", "type": "text|choice|number|date", "required": true/false }
  ]
}

Rules:
- Only flag truly critical missing info (not nice-to-haves)
- Max 3 questions
- If the objective is clear enough to act on, return has_enough_info: true`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.has_enough_info) return [];

      return (parsed.missing || []).map((m: { field: string; question: string; type?: string; required?: boolean }) => ({
        field: m.field,
        question: m.question,
        type: m.type || 'text',
        required: m.required ?? false,
      }));
    } catch (err) {
      console.error('[task-validator] AI check failed, proceeding without validation:', err);
      return [];
    }
  }
}
