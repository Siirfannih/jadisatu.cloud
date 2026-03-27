import { TenantManager } from '../tenants/manager.js';
import { ConversationStore } from '../memory/conversation-store.js';
import { ContextAssembler } from '../ai/context-assembler.js';
import { AIEngine } from '../ai/engine.js';
import { LeadScorer } from '../tools/lead-scorer.js';
import { HandoffTimer } from '../queue/handoff-timer.js';
import { BaileysManager } from './baileys-manager.js';
import { ShadowEvaluator } from '../evaluator/shadow-evaluator.js';
import { ResistanceDetector } from '../evaluator/resistance-detector.js';
import { MemoryUpdater } from '../evaluator/memory-updater.js';
import { PhaseController } from '../state-machine/phase-controller.js';
import type { Message, Mode, Handler, Conversation, TenantConfig, RoutingConfig } from '../types/shared.js';
import crypto from 'crypto';

export interface IncomingMessage {
  channel: 'whatsapp' | 'telegram';
  sender: string;
  content: string;
  timestamp: Date;
  raw: unknown;
  tenantId?: string; // Set by BaileysManager for per-tenant sessions
}

export class MessageRouter {
  private static instance: MessageRouter;
  private tenantManager = TenantManager.getInstance();
  private store = ConversationStore.getInstance();
  private assembler = ContextAssembler.getInstance();
  private aiEngine = AIEngine.getInstance();
  private scorer = LeadScorer.getInstance();
  private handoffTimer = HandoffTimer.getInstance();
  private waManager = BaileysManager.getInstance();
  private shadowEvaluator = ShadowEvaluator.getInstance();
  private resistanceDetector = ResistanceDetector.getInstance();
  private memoryUpdater = MemoryUpdater.getInstance();
  private phaseController = PhaseController.getInstance();

  static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter();
    }
    return MessageRouter.instance;
  }

  async handleIncoming(msg: IncomingMessage): Promise<void> {
    // If the message already has a tenantId (from BaileysManager), use it directly
    if (msg.tenantId) {
      return this.processMessage(msg.tenantId, msg);
    }

    const tenant = this.tenantManager.getByChannel(msg.channel, msg.sender);
    if (!tenant) {
      const defaultTenant = this.tenantManager.get('mandala');
      if (!defaultTenant) {
        console.error(`[router] No tenant found for ${msg.channel}:${msg.sender}`);
        return;
      }
      return this.processMessage(defaultTenant.id, msg);
    }
    return this.processMessage(tenant.id, msg);
  }

  private async processMessage(tenantId: string, msg: IncomingMessage): Promise<void> {
    const tenant = this.tenantManager.get(tenantId);
    if (!tenant) return;

    const mode = this.resolveMode(tenant.routing, msg.sender);
    const senderType = this.resolveSenderType(tenant.routing, msg.sender);

    let conversation = await this.store.getByCustomer(tenantId, msg.sender);
    if (!conversation) {
      conversation = await this.createConversation(tenantId, msg.sender, mode);
    }

    const incomingMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      tenant_id: tenantId,
      direction: 'incoming',
      sender: senderType,
      sender_number: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
    };

    await this.store.addMessage(conversation.id, incomingMessage);
    conversation.messages.push(incomingMessage);
    conversation.last_message_at = msg.timestamp;

    if (mode === 'ceo-assistant') {
      await this.handleCEOMode(conversation, incomingMessage, tenant);
    } else {
      await this.handleSalesMode(conversation, incomingMessage, tenant, senderType);
    }

    await this.store.update(conversation);
  }

  private async handleCEOMode(
    conversation: Conversation,
    message: Message,
    tenant: TenantConfig
  ): Promise<void> {
    console.log(`[router] CEO mode — ${message.sender_number}: "${message.content.substring(0, 50)}..."`);

    const context = await this.assembler.assemble(conversation, 'ceo-assistant', tenant);
    const response = await this.aiEngine.generate(context, tenant.ai);

    for (let i = 0; i < response.messages.length; i++) {
      const delay = response.delays[i] || 0;
      if (delay > 0) await this.sleep(delay);
      await this.sendMessage(conversation, 'mandala', response.messages[i], 'whatsapp');
    }
  }

  private async handleSalesMode(
    conversation: Conversation,
    message: Message,
    tenant: TenantConfig,
    senderType: 'customer' | 'owner' | 'admin' | 'mandala'
  ): Promise<void> {
    if (senderType === 'owner' || senderType === 'admin') {
      console.log(`[router] Owner/Admin replied in sales conv ${conversation.id} — Mandala standby`);
      conversation.current_handler = senderType as Handler;
      conversation.last_owner_reply_at = new Date();
      this.handoffTimer.cancel(conversation.id);
      return;
    }

    console.log(`[router] Sales mode — Customer ${message.sender_number}: "${message.content.substring(0, 50)}..." [phase=${conversation.phase}, score=${conversation.lead_score}]`);

    // ── Step 1: Fast local resistance check ──
    const resistance = this.resistanceDetector.detect(message.content);
    if (resistance) {
      console.log(`[router] Resistance detected: ${resistance.type} (${resistance.score_delta})`);
    }

    // ── Step 2: Shadow Evaluator (Haiku call) ──
    const recentMessages = await this.store.getRecentMessages(conversation.id, 5);
    const existingMemory = await this.memoryUpdater.getMemory(conversation.id);

    const evalResult = await this.shadowEvaluator.evaluate(
      message.content,
      recentMessages,
      conversation.phase,
      conversation.lead_score,
      existingMemory,
      tenant.ai.classifier_model
    );

    console.log(`[router] Evaluator: intent=${evalResult.intent}, signal=${evalResult.buying_signal}, delta=${evalResult.score_delta}, action=${evalResult.recommended_action}`);

    // ── Step 3: Apply score + phase transition ──
    // Use resistance delta if worse than evaluator delta
    const effectiveDelta = resistance && resistance.score_delta < evalResult.score_delta
      ? resistance.score_delta
      : evalResult.score_delta;

    if (effectiveDelta !== 0) {
      const signalType = effectiveDelta > 0 ? 'positive' : 'negative';
      await this.scorer.updateScore(conversation.id, {
        type: signalType,
        signal: evalResult.intent,
        points: effectiveDelta,
        detected_at: new Date(),
      });
      conversation.lead_score = await this.scorer.getScore(conversation.id);
      await this.store.updateScore(conversation.id, conversation.lead_score);
    }

    // Check for phase transition
    const transition = this.phaseController.evaluate(
      conversation.phase,
      conversation.lead_score,
      evalResult
    );

    if (transition) {
      console.log(`[router] Phase transition: ${transition.from} → ${transition.to} (${transition.reason})`);
      conversation.phase = transition.to;
      await this.store.updatePhase(conversation.id, transition.to);
    }

    // ── Step 4: Update customer memory (async, non-blocking for response) ──
    this.memoryUpdater.updateMemory(
      conversation.id,
      conversation.tenant_id,
      conversation.customer_number,
      recentMessages,
      existingMemory,
      tenant.ai.classifier_model
    ).catch((err) => console.error('[router] Memory update failed:', err));

    // ── Step 5: Handle based on evaluator recommendation ──
    if (evalResult.recommended_action === 'flag_owner') {
      await this.flagOwner(conversation, evalResult.reasoning || 'Evaluator flagged', tenant);
    }

    if (evalResult.recommended_action === 'close' || (resistance && resistance.action === 'graceful_close')) {
      // Graceful close — send final message, then let conversation wind down
      console.log(`[router] Graceful close recommended for ${conversation.id}`);
    }

    // ── Step 6: Handoff timer or direct response ──
    if (conversation.current_handler === 'owner' || conversation.current_handler === 'admin') {
      console.log(`[router] Owner was handling. Starting ${tenant.handoff.auto_takeover_delay_seconds}s timer.`);
      this.handoffTimer.start2MinTimer(conversation.id, async () => {
        await this.mandalaTakeOver(conversation, tenant);
      }, tenant.handoff.auto_takeover_delay_seconds * 1000);
      return;
    }

    if (conversation.current_handler === 'mandala' || conversation.current_handler === 'unassigned') {
      this.handoffTimer.start2MinTimer(conversation.id, async () => {
        await this.mandalaTakeOver(conversation, tenant);
      }, tenant.handoff.auto_takeover_delay_seconds * 1000);
    }
  }

  private async mandalaTakeOver(
    conversation: Conversation,
    tenant: TenantConfig
  ): Promise<void> {
    const freshConv = await this.store.get(conversation.id);
    if (!freshConv) return;

    if (freshConv.last_owner_reply_at &&
        freshConv.last_owner_reply_at > freshConv.last_message_at) {
      console.log(`[router] Owner already replied, Mandala stays standby`);
      return;
    }

    console.log(`[router] Mandala taking over conversation ${freshConv.id} [phase=${freshConv.phase}]`);
    freshConv.current_handler = 'mandala';

    // Get customer memory for context injection
    const memory = await this.memoryUpdater.getMemory(freshConv.id);
    const memoryMarkdown = memory ? this.memoryUpdater.renderForContext(memory) : undefined;

    const context = await this.assembler.assemble(freshConv, 'sales-shadow', tenant, memoryMarkdown);
    const response = await this.aiEngine.generate(context, tenant.ai);

    if (response.internal.score_update) {
      await this.scorer.updateScore(freshConv.id, response.internal.score_update);
      freshConv.lead_score = await this.scorer.getScore(freshConv.id);
    }

    if (response.internal.should_flag_owner) {
      console.log(`[router] Flagging owner: ${response.internal.flag_reason}`);
      await this.flagOwner(freshConv, response.internal.flag_reason || 'Needs attention', tenant);
    }

    for (let i = 0; i < response.messages.length; i++) {
      const delay = response.delays[i] || this.randomDelay(tenant.handoff.response_delay);
      await this.sleep(delay);

      const check = await this.store.get(freshConv.id);
      if (check && check.current_handler === 'owner') {
        console.log(`[router] Owner jumped in during delay, aborting Mandala reply`);
        return;
      }

      await this.sendMessage(freshConv, 'mandala', response.messages[i], 'whatsapp');
    }

    await this.store.update(freshConv);
  }

  private async sendMessage(
    conversation: Conversation,
    sender: 'mandala' | 'owner' | 'admin',
    content: string,
    channel: 'whatsapp' | 'telegram'
  ): Promise<void> {
    const message: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      tenant_id: conversation.tenant_id,
      direction: 'outgoing',
      sender,
      sender_number: 'mandala',
      content,
      timestamp: new Date(),
    };

    await this.store.addMessage(conversation.id, message);
    conversation.messages.push(message);

    if (channel === 'whatsapp') {
      await this.waManager.send(conversation.tenant_id, conversation.customer_number, content);
    }

    console.log(`[send] → ${conversation.customer_number}: "${content.substring(0, 60)}..."`);
  }

  private async flagOwner(
    conversation: Conversation,
    reason: string,
    tenant: TenantConfig
  ): Promise<void> {
    const ownerNumber = tenant.owner?.whatsapp;
    if (!ownerNumber) return;

    const phaseLabel: Record<string, string> = {
      kenalan: 'Kenalan',
      gali_masalah: 'Gali Masalah',
      tawarkan_solusi: 'Tawarkan Solusi',
      closing: 'Closing',
      rescue: 'Rescue',
    };

    const flagMsg = `[FLAG] Customer: ${conversation.customer_number}\n` +
      `Phase: ${phaseLabel[conversation.phase] || conversation.phase}\n` +
      `Score: ${conversation.lead_score}/100\n` +
      `Konteks: ${reason}\n` +
      `Last msg: "${conversation.messages[conversation.messages.length - 1]?.content?.substring(0, 100)}"`;

    await this.waManager.send(conversation.tenant_id, ownerNumber, flagMsg);
  }

  private resolveMode(routing: RoutingConfig, sender: string): Mode {
    if (routing.owner_numbers.includes(sender)) return 'ceo-assistant';
    if (routing.admin_numbers.includes(sender)) return 'ceo-assistant';
    return routing.default_mode;
  }

  private resolveSenderType(
    routing: RoutingConfig,
    sender: string
  ): 'customer' | 'owner' | 'admin' | 'mandala' {
    if (routing.owner_numbers.includes(sender)) return 'owner';
    if (routing.admin_numbers.includes(sender)) return 'admin';
    return 'customer';
  }

  private async createConversation(tenantId: string, customerNumber: string, mode: Mode): Promise<Conversation> {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      customer_number: customerNumber,
      status: 'active',
      current_handler: 'unassigned',
      mode,
      phase: 'kenalan',
      lead_score: 0,
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      last_message_at: new Date(),
    };
    await this.store.set(conv);
    return conv;
  }

  private randomDelay(config: { min_seconds: number; max_seconds: number; long_delay_chance: number }): number {
    const isLongDelay = Math.random() < config.long_delay_chance;
    if (isLongDelay) {
      return (30 + Math.random() * 30) * 1000;
    }
    return (config.min_seconds + Math.random() * (config.max_seconds - config.min_seconds)) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
