/**
 * BaileysProvider — Backwards-compatible wrapper around BaileysManager.
 *
 * Delegates all operations to BaileysManager for the default 'mandala' tenant.
 * Existing code (router, cold-messenger, task-executor) continues to work unchanged.
 */
import { EventEmitter } from 'events';
import { BaileysManager } from './baileys-manager.js';
import type { BaileysMessage } from './baileys-session.js';

export type { BaileysMessage } from './baileys-session.js';

const DEFAULT_TENANT = 'mandala';

export class BaileysProvider extends EventEmitter {
  private static instance: BaileysProvider;
  private manager = BaileysManager.getInstance();

  static getInstance(): BaileysProvider {
    if (!BaileysProvider.instance) {
      BaileysProvider.instance = new BaileysProvider();
    }
    return BaileysProvider.instance;
  }

  private constructor() {
    super();
    // Forward events from the manager for the default tenant
    this.manager.on('message', (tenantId: string, msg: BaileysMessage) => {
      if (tenantId === DEFAULT_TENANT) {
        this.emit('message', msg);
      }
    });
    this.manager.on('connected', (tenantId: string) => {
      if (tenantId === DEFAULT_TENANT) {
        this.emit('connected');
      }
    });
    this.manager.on('logged_out', (tenantId: string) => {
      if (tenantId === DEFAULT_TENANT) {
        this.emit('logged_out');
      }
    });
  }

  async connect(): Promise<void> {
    await this.manager.startSession(DEFAULT_TENANT);
  }

  async send(to: string, message: string): Promise<boolean> {
    return this.manager.send(DEFAULT_TENANT, to, message);
  }

  async sendTyping(to: string): Promise<void> {
    await this.manager.sendTyping(DEFAULT_TENANT, to);
  }

  isConnected(): boolean {
    return this.manager.isConnected(DEFAULT_TENANT);
  }
}
