// ============================================================
// Mandala Task Engine — Task Executor
//
// Bridges task objects into the existing Mandala runtime:
//   - Uses ContextAssembler for prompt construction
//   - Uses AIEngine for response generation
//   - Uses ConversationStore for conversation state
//   - Uses MemoryUpdater for customer memory
//   - Uses BaileysProvider for message delivery
//   - Respects approval_mode for review flow
// ============================================================

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TenantManager } from '../tenants/manager.js';
import { ConversationStore } from '../memory/conversation-store.js';
import { ContextAssembler } from '../ai/context-assembler.js';
import { AIEngine } from '../ai/engine.js';
import { MemoryUpdater } from '../evaluator/memory-updater.js';
import { BaileysProvider } from '../channels/baileys-provider.js';
import { isInternalMessage } from '../channels/message-guard.js';
import { TaskStore } from './task-store.js';
import type { MandalaTask, TaskDraft, TaskLogEntry } from './types.js';
import type { Conversation, Message, Mode, TenantConfig } from '../types/shared.js';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANDALA_DIR = join(__dirname, '../../../mandala');

export class TaskExecutor {
  private static instance: TaskExecutor;

  private tenantManager = TenantManager.getInstance();
  private store = ConversationStore.getInstance();
  private assembler = ContextAssembler.getInstance();
  private aiEngine = AIEngine.getInstance();
  private memoryUpdater = MemoryUpdater.getInstance();
  private wa = BaileysProvider.getInstance();
  private taskStore = TaskStore.getInstance();

  static getInstance(): TaskExecutor {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }

  /**
   * Execute a task through the Mandala runtime.
   *
   * Flow:
   * 1. Resolve tenant config
   * 2. Resolve or create conversation
   * 3. Assemble context (with task objective injected)
   * 4. Generate AI response (drafts)
   * 5. Apply approval mode:
   *    - draft_only → store drafts, set status to awaiting_review
   *    - semi_auto  → send unless flagged, then await review
   *    - fully_auto → send immediately
   */
  async execute(task: MandalaTask): Promise<void> {
    const log = (event: string, details?: Record<string, unknown>) => {
      const entry: TaskLogEntry = { timestamp: new Date(), event, details };
      this.taskStore.appendLog(task.id, entry).catch(() => {});
      console.log(`[task-executor] [${task.id.slice(0, 8)}] ${event}`, details ? JSON.stringify(details) : '');
    };

    try {
      await this.taskStore.updateStatus(task.id, 'in_progress');
      log('execution_started', { type: task.type, approval_mode: task.approval_mode });

      // Step 1: Resolve tenant
      const tenant = this.tenantManager.get(task.tenant_id);
      if (!tenant) {
        throw new Error(`Tenant not found: ${task.tenant_id}`);
      }

      // Step 2: Resolve or create conversation
      const conversation = await this.resolveConversation(task, tenant);
      await this.taskStore.setResultConversation(task.id, conversation.id);
      log('conversation_resolved', { conversation_id: conversation.id, is_new: !task.target.conversation_id });

      // Step 3: Load customer memory
      const memory = await this.memoryUpdater.getMemory(conversation.id);
      const memoryMarkdown = memory ? this.memoryUpdater.renderForContext(memory) : undefined;

      // Step 4: Assemble context with task overlay
      const mode = this.resolveMode(task);
      const context = await this.assembler.assemble(conversation, mode, tenant, memoryMarkdown);

      // Inject task-specific instructions into context
      context.phase_instruction = this.buildTaskInstruction(task, context.phase_instruction);

      // Load task execution protocol + type-specific skills into context
      const taskSkills = await this.loadTaskSkills(task);
      context.skills.push(...taskSkills);

      // Step 5: Generate response using task-aware method
      const response = await this.aiEngine.generateForTask(context, tenant.ai, task);
      log('response_generated', {
        message_count: response.messages.length,
        intent: response.internal.intent,
        confidence: response.internal.confidence,
        should_flag: response.internal.should_flag_owner,
      });

      // Enforce max_messages constraint
      const maxMessages = task.constraints.max_messages ?? 3;
      const messages = response.messages.slice(0, maxMessages);
      const delays = response.delays.slice(0, maxMessages);

      // Build drafts
      const drafts: TaskDraft[] = messages.map((content, i) => ({
        content,
        delay_ms: delays[i] || 0,
        confidence: response.internal.confidence,
      }));

      await this.taskStore.setDrafts(task.id, drafts);
      log('drafts_stored', { count: drafts.length });

      // Guard: if no drafts generated, fail the task
      if (drafts.length === 0) {
        throw new Error('AI generated 0 draft messages — no content to send');
      }

      // Step 6: Apply approval mode
      if (task.approval_mode === 'draft_only') {
        await this.taskStore.updateStatus(task.id, 'awaiting_review');
        log('awaiting_review', { reason: 'draft_only mode' });
        return;
      }

      if (task.approval_mode === 'semi_auto') {
        // In semi_auto, send unless AI flagged for owner review
        if (response.internal.should_flag_owner) {
          await this.taskStore.updateStatus(task.id, 'awaiting_review');
          log('awaiting_review', {
            reason: 'semi_auto_flagged',
            flag_reason: response.internal.flag_reason,
          });
          return;
        }
        // Also hold back if confidence is low
        const avgConfidence = drafts.reduce((sum, d) => sum + d.confidence, 0) / drafts.length;
        if (avgConfidence < 0.5) {
          await this.taskStore.updateStatus(task.id, 'awaiting_review');
          log('awaiting_review', { reason: 'low_confidence', confidence: avgConfidence });
          return;
        }
      }

      // fully_auto or semi_auto (not flagged) → send
      await this.sendDrafts(task, conversation, drafts);
      await this.taskStore.updateStatus(task.id, 'executed');
      log('executed', { messages_sent: drafts.length });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[task-executor] Task ${task.id} failed:`, message);
      await this.taskStore.setError(task.id, message);
      log('failed', { error: message });
    }
  }

  /**
   * Approve a task that is awaiting_review — sends its stored drafts.
   */
  async approve(taskId: string): Promise<void> {
    const task = await this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== 'awaiting_review') {
      throw new Error(`Task ${taskId} is not awaiting review (status: ${task.status})`);
    }
    if (task.drafts.length === 0) {
      throw new Error(`Task ${taskId} has no drafts to send`);
    }

    const conversation = task.result_conversation_id
      ? await this.store.get(task.result_conversation_id)
      : undefined;

    if (!conversation) {
      throw new Error(`Conversation not found for task ${taskId}`);
    }

    await this.taskStore.updateStatus(task.id, 'approved');
    await this.sendDrafts(task, conversation, task.drafts);
    await this.taskStore.updateStatus(task.id, 'executed');
    await this.taskStore.appendLog(task.id, {
      timestamp: new Date(),
      event: 'approved_and_executed',
      details: { messages_sent: task.drafts.length },
    });
  }

  /**
   * Retry a failed or awaiting_review task (re-execute from scratch).
   */
  async retry(taskId: string): Promise<void> {
    const task = await this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== 'failed' && task.status !== 'awaiting_review') {
      throw new Error(`Cannot retry task in status: ${task.status}`);
    }

    // Reset task state
    await this.taskStore.updateStatus(task.id, 'pending', { retried: true });
    await this.taskStore.setDrafts(task.id, []);
    await this.taskStore.appendLog(task.id, {
      timestamp: new Date(),
      event: 'retry_requested',
    });

    // Re-fetch the task with updated status
    const refreshed = await this.taskStore.get(taskId);
    if (!refreshed) throw new Error(`Task not found after reset: ${taskId}`);

    // Re-execute
    this.execute(refreshed).catch((err) =>
      console.error(`[task-executor] Retry failed for task ${taskId}:`, err)
    );
  }

  /**
   * Cancel a pending or awaiting_review task.
   */
  async cancel(taskId: string): Promise<void> {
    const task = await this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== 'pending' && task.status !== 'awaiting_review') {
      throw new Error(`Cannot cancel task in status: ${task.status}`);
    }

    await this.taskStore.updateStatus(task.id, 'cancelled', { cancelled_by: 'manual' });
  }

  // ── Private helpers ──

  /**
   * Load task-specific skill files into context.
   * Always loads the task execution protocol + type-specific skill.
   */
  private async loadTaskSkills(task: MandalaTask): Promise<string[]> {
    const skills: string[] = [];

    // Always load task execution protocol
    const protocol = await this.loadMandalaFile('skills/task-execution-protocol.md');
    if (protocol) skills.push(protocol);

    // Load type-specific skill
    const typeSkillMap: Record<string, string> = {
      outreach: 'skills/sales/outreach.md',
      rescue: 'skills/sales/objection-handling.md',
      follow_up: 'skills/conversation/natural-flow.md',
      qualification: 'skills/sales/qualifying.md',
      inbound_response: 'skills/conversation/natural-flow.md',
    };

    const skillPath = typeSkillMap[task.type];
    if (skillPath) {
      const skill = await this.loadMandalaFile(skillPath);
      if (skill) skills.push(skill);
    }

    return skills;
  }

  /**
   * Read a file from the mandala content directory.
   */
  private async loadMandalaFile(relativePath: string): Promise<string> {
    try {
      const fullPath = join(MANDALA_DIR, relativePath);
      return await readFile(fullPath, 'utf-8');
    } catch {
      console.warn(`[task-executor] Could not load mandala file: ${relativePath}`);
      return '';
    }
  }

  /**
   * Resolve or create a conversation for the task target.
   */
  private async resolveConversation(
    task: MandalaTask,
    tenant: TenantConfig
  ): Promise<Conversation> {
    // If task references an existing conversation, use it
    if (task.target.conversation_id) {
      const existing = await this.store.get(task.target.conversation_id);
      if (existing) return existing;
    }

    // Try to find an active conversation with this customer
    const existing = await this.store.getByCustomer(task.tenant_id, task.target.customer_number);
    if (existing) return existing;

    // Create a new conversation for outreach/qualification
    const conv: Conversation = {
      id: crypto.randomUUID(),
      tenant_id: task.tenant_id,
      customer_number: task.target.customer_number,
      customer_name: task.target.customer_name,
      status: 'active',
      current_handler: 'mandala',
      mode: this.resolveMode(task) as 'ceo-assistant' | 'sales-shadow',
      phase: task.type === 'outreach' ? 'kenalan' : 'kenalan',
      lead_score: 0,
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      last_message_at: new Date(),
    };

    await this.store.set(conv);
    return conv;
  }

  /**
   * Map task type to a runtime mode.
   */
  private resolveMode(task: MandalaTask): Mode {
    // All task types operate in sales-shadow mode (customer-facing)
    return 'sales-shadow';
  }

  /**
   * Build task-specific instruction to overlay on the phase instruction.
   */
  private buildTaskInstruction(task: MandalaTask, existingPhaseInstruction?: string): string {
    const parts: string[] = [];

    // Keep existing phase instruction if present
    if (existingPhaseInstruction) {
      parts.push(existingPhaseInstruction);
    }

    // Add task objective
    parts.push(`\n# Task Objective\n${task.objective}`);

    // Add task context
    if (task.context) {
      parts.push(`\n# Additional Context\n${task.context}`);
    }

    // Add task-type-specific instructions
    const typeInstructions: Record<string, string> = {
      outreach: `INSTRUKSI OUTREACH:
- Ini adalah pesan pertama ke prospect baru
- Perkenalkan diri secara natural, jangan langsung jualan
- Referensi konteks yang sudah diberikan tentang bisnis mereka
- Buat mereka tertarik untuk membalas`,

      follow_up: `INSTRUKSI FOLLOW UP:
- Customer sudah pernah dihubungi sebelumnya
- Referensi percakapan terakhir secara natural
- Tanya kabar dan perkembangan mereka
- Arahkan kembali ke topik tanpa terkesan pushy`,

      rescue: `INSTRUKSI RESCUE:
- Customer menunjukkan tanda-tanda kehilangan minat
- JANGAN push, malah mundur dan tunjukkan empati
- Tawarkan value tanpa komitmen (tips, insight, bantuan)
- Tujuan: rebuild trust, bukan close deal`,

      inbound_response: `INSTRUKSI INBOUND RESPONSE:
- Customer yang mengirim pesan duluan
- Respon dengan cepat dan helpful
- Jawab pertanyaan mereka langsung
- Identify intent dan arahkan ke fase yang tepat`,

      qualification: `INSTRUKSI QUALIFICATION:
- Tujuan utama: qualify lead ini
- Cari tahu: ukuran bisnis, masalah utama, budget range, timeline
- Gunakan pertanyaan terbuka
- Score berdasarkan jawaban mereka`,
    };

    if (typeInstructions[task.type]) {
      parts.push(`\n${typeInstructions[task.type]}`);
    }

    // Add constraints
    const constraintParts: string[] = [];
    if (task.constraints.forbidden_topics?.length) {
      constraintParts.push(`- JANGAN membahas: ${task.constraints.forbidden_topics.join(', ')}`);
    }
    if (task.constraints.no_pricing) {
      constraintParts.push('- JANGAN membahas harga dalam pesan ini');
    }
    if (task.constraints.tone) {
      constraintParts.push(`- Tone: ${task.constraints.tone}`);
    }
    if (task.constraints.language) {
      constraintParts.push(`- Bahasa: ${task.constraints.language}`);
    }

    if (constraintParts.length > 0) {
      parts.push(`\n# Constraints\n${constraintParts.join('\n')}`);
    }

    return parts.join('\n');
  }

  /**
   * Send drafted messages through the channel adapter.
   * This is the final delivery step — it persists messages and sends via WhatsApp.
   */
  private async sendDrafts(
    task: MandalaTask,
    conversation: Conversation,
    drafts: TaskDraft[]
  ): Promise<void> {
    // Safety guard: filter out any drafts containing internal messages
    const safeDrafts = drafts.filter((draft) => {
      const guard = isInternalMessage(draft.content);
      if (guard.blocked) {
        console.error(
          `[task-executor] BLOCKED internal draft from reaching customer ${conversation.customer_number}: ${guard.reason}\n` +
          `  Content: "${draft.content.substring(0, 100)}..."`
        );
        return false;
      }
      return true;
    });

    if (safeDrafts.length === 0) {
      console.error(`[task-executor] ALL drafts blocked by guard for ${conversation.customer_number} — nothing to send`);
      return;
    }

    for (let i = 0; i < safeDrafts.length; i++) {
      const draft = safeDrafts[i];

      // Apply delay for natural pacing (skip delay for first message)
      if (i > 0 && draft.delay_ms > 0) {
        await this.sleep(draft.delay_ms);
      }

      // Persist the message
      const message: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversation.id,
        tenant_id: task.tenant_id,
        direction: 'outgoing',
        sender: 'mandala',
        sender_number: 'mandala',
        content: draft.content,
        timestamp: new Date(),
        metadata: { task_id: task.id, task_type: task.type },
      };

      await this.store.addMessage(conversation.id, message);

      // Send via channel
      if (task.target.channel === 'whatsapp') {
        await this.wa.send(conversation.customer_number, draft.content);
      }

      console.log(`[task-executor] Sent message ${i + 1}/${safeDrafts.length} to ${conversation.customer_number}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
