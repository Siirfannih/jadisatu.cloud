/**
 * BaileysSession — Per-tenant WhatsApp connection via Baileys.
 *
 * Each tenant gets its own WASocket, auth directory, and reconnection logic.
 * QR codes are emitted as events (not printed to terminal) for cockpit display.
 */
import baileys, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { join, dirname } from 'path';
import { readdir, stat, unlink, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_BASE = join(__dirname, '../../auth_info');

const baileysLogger = pino({ level: 'silent' });

export interface BaileysMessage {
  sender: string;
  content: string;
  timestamp: Date;
  messageId: string;
  pushName?: string;
  isGroup: boolean;
  raw: proto.IWebMessageInfo;
}

export type SessionStatus = 'disconnected' | 'qr_pending' | 'connecting' | 'connected' | 'logged_out';

export interface SessionState {
  tenantId: string;
  status: SessionStatus;
  qrCode?: string;
  phoneNumber?: string;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastQrAt?: Date;
  errorMessage?: string;
}

export class BaileysSession extends EventEmitter {
  readonly tenantId: string;
  private sock: WASocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  private recoveringJids = new Set<string>();
  private _status: SessionStatus = 'disconnected';
  /** LID → phone JID mapping (e.g. "48224043823326@lid" → "6281353848164@s.whatsapp.net") */
  private lidToPhone = new Map<string, string>();
  private _qrCode?: string;
  private _phoneNumber?: string;
  private _connectedAt?: Date;
  private _disconnectedAt?: Date;
  private _lastQrAt?: Date;
  private _errorMessage?: string;

  constructor(tenantId: string) {
    super();
    this.tenantId = tenantId;
  }

  private get authDir(): string {
    return join(AUTH_BASE, `tenant-${this.tenantId}`);
  }

  private log(msg: string, ...args: unknown[]): void {
    console.log(`[baileys:${this.tenantId}] ${msg}`, ...args);
  }

  private logError(msg: string, ...args: unknown[]): void {
    console.error(`[baileys:${this.tenantId}] ${msg}`, ...args);
  }

  get state(): SessionState {
    return {
      tenantId: this.tenantId,
      status: this._status,
      qrCode: this._qrCode,
      phoneNumber: this._phoneNumber,
      connectedAt: this._connectedAt,
      disconnectedAt: this._disconnectedAt,
      lastQrAt: this._lastQrAt,
      errorMessage: this._errorMessage,
    };
  }

  get status(): SessionStatus {
    return this._status;
  }

  private setStatus(status: SessionStatus): void {
    this._status = status;
    this.emit('status_change', this.state);
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      this.log('Already connecting, skipping...');
      return;
    }
    this.isConnecting = true;
    this._errorMessage = undefined;
    this.setStatus('connecting');

    try {
      // Ensure auth directory exists
      await mkdir(this.authDir, { recursive: true });
      await this.pruneSessionFiles();

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const makeWASocket = (baileys as any)['default'] || baileys;

      const sock: WASocket = makeWASocket({
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        printQRInTerminal: false, // QR goes to events, not terminal
        version: [2, 3000, 1034074495],
        browser: ['Chrome', 'Windows', '110.0.5481.177'] as any,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        shouldIgnoreJid: (jid: string) => jid === 'status@broadcast',
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      // LID mapping: capture LID → phone JID from Baileys events
      sock.ev.on('chats.phoneNumberShare' as any, ({ lid, jid }: { lid: string; jid: string }) => {
        if (lid && jid) {
          this.lidToPhone.set(lid, jid);
          this.log(`LID mapped: ${lid} → ${jid}`);
        }
      });

      sock.ev.on('contacts.upsert', (contacts: any[]) => {
        for (const contact of contacts) {
          if (contact.lid && contact.jid) {
            this.lidToPhone.set(contact.lid, contact.jid);
          } else if (contact.lid && contact.id?.endsWith('@s.whatsapp.net')) {
            this.lidToPhone.set(contact.lid, contact.id);
          } else if (contact.id?.endsWith('@lid') && contact.jid) {
            this.lidToPhone.set(contact.id, contact.jid);
          }
        }
        const mapped = contacts.filter((c) => c.lid || c.id?.endsWith('@lid')).length;
        if (mapped > 0) this.log(`Contacts synced: ${mapped} LID mapping(s) captured`);
      });

      sock.ev.on('contacts.update', (contacts: any[]) => {
        for (const contact of contacts) {
          if (contact.lid && contact.jid) {
            this.lidToPhone.set(contact.lid, contact.jid);
          } else if (contact.id?.endsWith('@lid') && contact.jid) {
            this.lidToPhone.set(contact.id, contact.jid);
          }
        }
      });

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this._qrCode = qr;
          this._lastQrAt = new Date();
          this.setStatus('qr_pending');
          this.log('QR code generated — waiting for scan');
          this.emit('qr', qr);
        }

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.log(`Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (!shouldReconnect) {
            this._qrCode = undefined;
            this._disconnectedAt = new Date();
            this.setStatus('logged_out');
            this.emit('logged_out');
            return;
          }

          this._disconnectedAt = new Date();
          this.setStatus('disconnected');
          this.emit('disconnected');

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(5000 * this.reconnectAttempts, 30000);
            this.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), delay);
          }
        }

        if (connection === 'open') {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this._qrCode = undefined;
          this._connectedAt = new Date();
          this._phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
          this.setStatus('connected');
          this.log(`Connected — phone: ${this._phoneNumber}`);
          this.emit('connected', this._phoneNumber);
        }
      });

      // Incoming messages
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
          if (type !== 'notify') return;

          for (const msg of messages) {
            try {
              const rawJid = msg.key.remoteJid || '';
              if (rawJid === 'status@broadcast') continue;
              if (msg.key.fromMe) continue;
              if (rawJid.endsWith('@g.us')) continue;

              const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                '';

              if (!text.trim()) continue;

              // Resolve LID to phone JID if possible
              const sender = this.resolveLid(rawJid);
              if (sender !== rawJid) {
                this.log(`LID resolved: ${rawJid} → ${sender}`);
              }

              this.log(`From ${sender} (${msg.pushName || 'unknown'}): "${text.substring(0, 80)}"`);

              // Mark as read
              try { await sock.readMessages([msg.key]); } catch { /* non-critical */ }

              this.emit('message', {
                sender,
                content: text,
                timestamp: new Date((msg.messageTimestamp as number) * 1000),
                messageId: msg.key.id || '',
                pushName: msg.pushName || undefined,
                isGroup: false,
                raw: msg,
              } satisfies BaileysMessage);
            } catch (msgErr) {
              this.logError('Error processing message:', msgErr);
            }
          }
        } catch (err) {
          this.logError('Error in messages.upsert handler:', err);
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this._errorMessage = err instanceof Error ? err.message : String(err);
      this.setStatus('disconnected');
      this.logError('Connection error:', err);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 10000);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        // If logout fails, just end the connection
        this.sock.end(undefined);
      }
      this.sock = null;
    }
    this._qrCode = undefined;
    this._disconnectedAt = new Date();
    this.setStatus('disconnected');
    this.log('Disconnected');
  }

  async send(to: string, message: string): Promise<boolean> {
    if (!this.sock) {
      this.logError('Not connected — cannot send');
      return false;
    }

    try {
      const jid = this.toJid(to);
      await this.sock.sendMessage(jid, { text: message });
      this.log(`Sent to ${to}: "${message.substring(0, 50)}..."`);
      return true;
    } catch (err) {
      this.logError(`Send error to ${to}:`, err);
      await this.recoverSessionForJid(this.toJid(to), err);
      return false;
    }
  }

  async sendTyping(to: string): Promise<void> {
    if (!this.sock) return;
    try {
      await this.sock.sendPresenceUpdate('composing', this.toJid(to));
    } catch { /* non-critical */ }
  }

  async stopTyping(to: string): Promise<void> {
    if (!this.sock) return;
    try {
      await this.sock.sendPresenceUpdate('paused', this.toJid(to));
    } catch { /* non-critical */ }
  }

  isConnected(): boolean {
    return this.sock !== null && this._status === 'connected';
  }

  private toJid(input: string): string {
    if (input.includes('@')) return input;
    let clean = input.replace(/^\+/, '');
    // Convert Indonesian local format (08xxx) to international (628xxx)
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Resolve a LID JID to a phone JID using the cached mapping.
   * If no mapping exists, returns the original JID unchanged.
   */
  private resolveLid(jid: string): string {
    if (!jid.endsWith('@lid')) return jid;
    const phone = this.lidToPhone.get(jid);
    return phone || jid;
  }

  /**
   * Register a LID → phone mapping manually (e.g. from conversation context).
   */
  registerLidMapping(lid: string, phoneJid: string): void {
    if (lid && phoneJid) {
      this.lidToPhone.set(lid, phoneJid);
      this.log(`LID registered: ${lid} → ${phoneJid}`);
    }
  }

  /**
   * Get all known LID mappings (for debugging/API).
   */
  getLidMappings(): Record<string, string> {
    return Object.fromEntries(this.lidToPhone);
  }

  private async pruneSessionFiles(): Promise<void> {
    try {
      let files: string[];
      try {
        files = (await readdir(this.authDir))
          .filter((file) => file.startsWith('session-') && file.endsWith('.json'));
      } catch {
        return; // Directory doesn't exist yet
      }

      const groups = new Map<string, { file: string; mtimeMs: number }[]>();

      for (const file of files) {
        const fullPath = join(this.authDir, file);
        const fileStat = await stat(fullPath);
        const bareSessionId = file.replace(/^session-/, '').replace(/\.json$/, '');
        const baseIdentity = bareSessionId.replace(/\.\d+$/, '');

        const current = groups.get(baseIdentity) || [];
        current.push({ file, mtimeMs: fileStat.mtimeMs });
        groups.set(baseIdentity, current);
      }

      for (const [baseIdentity, entries] of groups.entries()) {
        if (entries.length <= 1) continue;
        entries.sort((left, right) => right.mtimeMs - left.mtimeMs);
        const keep = entries[0]?.file;
        const remove = entries.slice(1);
        for (const entry of remove) {
          await unlink(join(this.authDir, entry.file));
          this.log(`Pruned stale session file for ${baseIdentity}: ${entry.file}`);
        }
        if (keep) {
          this.log(`Keeping freshest session for ${baseIdentity}: ${keep}`);
        }
      }
    } catch (err) {
      this.logError('Failed to prune session files:', err);
    }
  }

  private async recoverSessionForJid(jid: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

    if (
      !message.includes('bad mac') &&
      !message.includes('no matching sessions') &&
      !message.includes('failed to decrypt') &&
      !message.includes('connection closed')
    ) {
      return;
    }

    const baseIdentity = this.baseSessionIdentity(jid);
    if (!baseIdentity || this.recoveringJids.has(baseIdentity)) return;

    this.recoveringJids.add(baseIdentity);
    try {
      const files = await readdir(this.authDir);
      const matching = files.filter(
        (file) => file.startsWith(`session-${baseIdentity}`) && file.endsWith('.json')
      );
      for (const file of matching) {
        await unlink(join(this.authDir, file));
        this.log(`Deleted corrupt session file for ${baseIdentity}: ${file}`);
      }
    } catch (cleanupErr) {
      this.logError(`Failed to recover session for ${baseIdentity}:`, cleanupErr);
    } finally {
      this.recoveringJids.delete(baseIdentity);
    }
  }

  private baseSessionIdentity(jid: string): string {
    const bare = jid.split('@')[0] || '';
    return bare.replace(/:\d+$/, '');
  }
}
