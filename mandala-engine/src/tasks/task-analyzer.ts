/**
 * TaskAnalyzer — AI-powered task analysis and decomposition.
 *
 * Analyzes incoming tasks for ambiguity, generates clarification questions,
 * and creates execution plans with subtasks.
 *
 * Uses Gemini Flash (cheap) for analysis, Gemini Pro for planning.
 */
import { getModel } from '../ai/gemini-client.js';
import type {
  MandalaTask,
  ClarificationQuestion,
  TaskPlan,
  PlanStep,
} from './types.js';

export class TaskAnalyzer {
  private static instance: TaskAnalyzer;

  static getInstance(): TaskAnalyzer {
    if (!TaskAnalyzer.instance) {
      TaskAnalyzer.instance = new TaskAnalyzer();
    }
    return TaskAnalyzer.instance;
  }

  /**
   * Analyze a task for ambiguity and generate clarification questions.
   * Returns null if the task is clear enough to proceed without clarification.
   */
  async analyzeAndClarify(
    task: MandalaTask,
    classifierModel: string
  ): Promise<ClarificationQuestion[] | null> {
    try {
      const model = getModel(classifierModel, {
        temperature: 0.2,
        maxOutputTokens: 1024,
      });

      const result = await model.generateContent({
        systemInstruction: `Kamu adalah task analyzer untuk AI customer service di industri hospitality.
Tugasmu: analisis sebuah task dan tentukan apakah informasi sudah cukup untuk dieksekusi.

ATURAN:
- Jika task sudah jelas dan lengkap, output: {"needs_clarification": false}
- Jika ada informasi yang kurang/ambigu, generate pertanyaan klarifikasi
- Fokus pada informasi yang KRITIS untuk eksekusi, bukan nice-to-have
- Maksimal 5 pertanyaan
- Pertanyaan harus spesifik dan actionable
- Setiap pertanyaan punya field name (untuk tracking), question text, dan type

Contoh task yang perlu klarifikasi:
- "Hubungi tamu kamar 301" → Perlu: tujuan kontak, waktu yang tepat, informasi booking
- "Follow up booking" → Perlu: detail booking, tanggal, special request
- "Handle complaint" → Perlu: jenis complaint, apa yang sudah dilakukan, resolusi yang diharapkan

Contoh task yang TIDAK perlu klarifikasi:
- "Balas pesan tamu yang bertanya jam checkout" → Cukup jelas
- "Konfirmasi booking atas nama Budi untuk 5 April, 2 malam" → Sudah lengkap`,
        contents: [{
          role: 'user',
          parts: [{
            text: `Analisa task ini:

Type: ${task.type}
Objective: ${task.objective}
Target: ${task.target.customer_number} (${task.target.customer_name || 'unknown'})
Context: ${task.context || 'none'}

Output JSON ONLY:
{
  "needs_clarification": true/false,
  "reasoning": "penjelasan singkat",
  "questions": [
    {
      "field": "field_name",
      "question": "pertanyaan lengkap",
      "type": "text|choice|number|date",
      "options": ["option1", "option2"],
      "required": true/false
    }
  ]
}`,
          }],
        }],
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.needs_clarification || !parsed.questions?.length) {
        return null;
      }

      return parsed.questions.map((q: Record<string, unknown>) => ({
        field: q.field as string || 'unknown',
        question: q.question as string,
        type: (q.type as string) || 'text',
        options: q.options as string[] | undefined,
        required: q.required !== false,
      }));

    } catch (err) {
      console.error('[task-analyzer] Analysis failed:', err);
      // On error, proceed without clarification rather than blocking
      return null;
    }
  }

  /**
   * Generate an execution plan after clarification answers are provided.
   * Uses the task + clarification answers to create a step-by-step plan.
   */
  async generatePlan(
    task: MandalaTask,
    conversationModel: string
  ): Promise<TaskPlan> {
    const model = getModel(conversationModel, {
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    // Build context from clarification answers
    const clarificationContext = task.clarification?.answered
      ? Object.entries(task.clarification.answered)
          .map(([field, answer]) => `- ${field}: ${answer}`)
          .join('\n')
      : 'No clarification needed.';

    const result = await model.generateContent({
      systemInstruction: `Kamu adalah planner untuk AI customer service hospitality.
Tugasmu: buat execution plan yang detail untuk sebuah task.

ATURAN:
- Plan harus step-by-step, actionable
- Setiap step punya action (apa yang dilakukan) dan description (detail)
- Urutkan dari yang harus dilakukan duluan
- Pertimbangkan konteks dan jawaban klarifikasi
- Plan harus realistis untuk AI CS yang berkomunikasi via WhatsApp
- Estimasi berapa pesan yang diperlukan per step

Output JSON ONLY.`,
      contents: [{
        role: 'user',
        parts: [{
          text: `Buat execution plan untuk task ini:

Type: ${task.type}
Objective: ${task.objective}
Target: ${task.target.customer_number} (${task.target.customer_name || 'unknown'})
Context: ${task.context || 'none'}
Constraints: ${JSON.stringify(task.constraints)}

Informasi tambahan dari klarifikasi:
${clarificationContext}

Output JSON:
{
  "approach": "ringkasan pendekatan dalam 1-2 kalimat",
  "reasoning": "kenapa pendekatan ini dipilih",
  "steps": [
    {
      "order": 1,
      "action": "nama_action (e.g., greet, ask_info, confirm, send_info)",
      "description": "deskripsi detail apa yang dilakukan",
      "estimated_messages": 1
    }
  ]
}`,
        }],
      }],
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('AI failed to generate execution plan');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      steps: (parsed.steps || []).map((s: Record<string, unknown>, i: number) => ({
        order: (s.order as number) || i + 1,
        action: s.action as string || `step_${i + 1}`,
        description: s.description as string || '',
        estimated_messages: s.estimated_messages as number | undefined,
      })),
      reasoning: parsed.reasoning || '',
      approach: parsed.approach || '',
      approved: false,
    };
  }

  /**
   * Regenerate a plan with rejection feedback.
   */
  async regeneratePlan(
    task: MandalaTask,
    feedback: string,
    conversationModel: string
  ): Promise<TaskPlan> {
    const model = getModel(conversationModel, {
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    const previousPlan = task.plan
      ? JSON.stringify(task.plan.steps, null, 2)
      : 'No previous plan.';

    const clarificationContext = task.clarification?.answered
      ? Object.entries(task.clarification.answered)
          .map(([field, answer]) => `- ${field}: ${answer}`)
          .join('\n')
      : '';

    const result = await model.generateContent({
      systemInstruction: `Kamu adalah planner untuk AI customer service hospitality.
Sebuah plan sebelumnya ditolak oleh user. Buat plan baru yang lebih baik berdasarkan feedback.`,
      contents: [{
        role: 'user',
        parts: [{
          text: `Task:
Type: ${task.type}
Objective: ${task.objective}
Target: ${task.target.customer_number}
Context: ${task.context || 'none'}

Informasi klarifikasi:
${clarificationContext}

Plan sebelumnya (DITOLAK):
${previousPlan}

Feedback dari user:
"${feedback}"

Buat plan baru yang memperbaiki masalah yang disampaikan. Output JSON:
{
  "approach": "ringkasan pendekatan baru",
  "reasoning": "kenapa pendekatan ini lebih baik",
  "steps": [
    {
      "order": 1,
      "action": "nama_action",
      "description": "deskripsi detail",
      "estimated_messages": 1
    }
  ]
}`,
        }],
      }],
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('AI failed to regenerate execution plan');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      steps: (parsed.steps || []).map((s: Record<string, unknown>, i: number) => ({
        order: (s.order as number) || i + 1,
        action: s.action as string || `step_${i + 1}`,
        description: s.description as string || '',
        estimated_messages: s.estimated_messages as number | undefined,
      })),
      reasoning: parsed.reasoning || '',
      approach: parsed.approach || '',
      approved: false,
      rejection_feedback: feedback,
    };
  }
}
