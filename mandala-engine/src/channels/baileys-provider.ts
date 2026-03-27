/**
 * Baileys WhatsApp Provider — Direct WhatsApp Web connection
 * This is Mandala's own WhatsApp server, no third-party gateway needed.
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
import { readdir, stat, unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '../../auth_info');

// Pino logger — Baileys requires a real pino instance
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

export class BaileysProvider extends EventEmitter {
  private static instance: BaileysProvider;
  private sock: WASocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  private recoveringJids = new Set<string>();

  static getInstance(): BaileysProvider {
    if (!BaileysProvider.instance) {
      BaileysProvider.instance = new BaileysProvider();
    }
    return BaileysProvider.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('[baileys] Already connecting, skipping...');
      return;
    }
    this.isConnecting = true;

    try {
      await this.pruneSessionFiles();

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const makeWASocket = (baileys as any)['default'] || baileys;

      const sock: WASocket = makeWASocket({
        logger: baileysLogger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        printQRInTerminal: true,
        version: [2, 3000, 1034074495],
        browser: ['Chrome', 'Windows', '110.0.5481.177'] as any,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        shouldIgnoreJid: (jid: string) => {
          return jid === 'status@broadcast';
        },
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[baileys] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('[baileys] QR code displayed — scan with WhatsApp');
          console.log('[baileys] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          this.emit('qr', qr);
        }

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[baileys] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(5000 * this.reconnectAttempts, 30000);
            console.log(`[baileys] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), delay);
          } else if (!shouldReconnect) {
            console.log('[baileys] Logged out. Delete auth_info/ and restart.');
            this.emit('logged_out');
          }
        }

        if (connection === 'open') {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('  ✓ WhatsApp CONNECTED — Mandala is LIVE');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          this.emit('connected');
        }
      });

      // Incoming messages
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
          if (type !== 'notify') return;

          for (const msg of messages) {
            try {
              const jid = msg.key.remoteJid || '';

              if (jid === 'status@broadcast') continue;
              if (msg.key.fromMe) continue;
              if (jid.endsWith('@g.us')) continue;

              const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                '';

              if (!text.trim()) {
                console.log(`[baileys] Non-text message from ${jid}, skipping`);
                continue;
              }

              console.log(`[baileys] From ${jid} (${msg.pushName || 'unknown'}): "${text.substring(0, 80)}"`);

              // Mark as read
              try {
                await sock.readMessages([msg.key]);
              } catch {
                // Non-critical
              }

              this.emit('message', {
                sender: jid,
                content: text,
                timestamp: new Date((msg.messageTimestamp as number) * 1000),
                messageId: msg.key.id || '',
                pushName: msg.pushName || undefined,
                isGroup: false,
                raw: msg,
              } satisfies BaileysMessage);
            } catch (msgErr) {
              console.error('[baileys] Error processing single message:', msgErr);
            }
          }
        } catch (err) {
          console.error('[baileys] Error in messages.upsert handler:', err);
        }
      });
    } catch (err) {
      this.isConnecting = false;
      console.error('[baileys] Connection error:', err);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 10000);
      }
    }
  }

  async send(to: string, message: string): Promise<boolean> {
    if (!this.sock) {
      console.error('[baileys] Not connected — cannot send');
      return false;
    }

    try {
      const jid = this.toJid(to);
      await this.sock.sendMessage(jid, { text: message });
      console.log(`[baileys] Sent to ${to}: "${message.substring(0, 50)}..."`);
      return true;
    } catch (err) {
      console.error(`[baileys] Send error to ${to}:`, err);
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
    return this.sock !== null && !this.isConnecting;
  }

  private toJid(input: string): string {
    if (input.includes('@')) return input;
    const clean = input.replace(/^\+/, '');
    return `${clean}@s.whatsapp.net`;
  }

  private async pruneSessionFiles(): Promise<void> {
    try {
      const files = (await readdir(AUTH_DIR))
        .filter((file) => file.startsWith('session-') && file.endsWith('.json'));

      const groups = new Map<string, { file: string; mtimeMs: number }[]>();

      for (const file of files) {
        const fullPath = join(AUTH_DIR, file);
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
          await unlink(join(AUTH_DIR, entry.file));
          console.warn(`[baileys] Pruned stale session file for ${baseIdentity}: ${entry.file}`);
        }
        if (keep) {
          console.log(`[baileys] Keeping freshest session for ${baseIdentity}: ${keep}`);
        }
      }
    } catch (err) {
      console.error('[baileys] Failed to prune session files:', err);
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
    if (!baseIdentity || this.recoveringJids.has(baseIdentity)) {
      return;
    }

    this.recoveringJids.add(baseIdentity);
    try {
      const files = await readdir(AUTH_DIR);
      const matching = files.filter(
        (file) => file.startsWith(`session-${baseIdentity}`) && file.endsWith('.json')
      );
      for (const file of matching) {
        await unlink(join(AUTH_DIR, file));
        console.warn(`[baileys] Deleted corrupt session file for ${baseIdentity}: ${file}`);
      }
    } catch (cleanupErr) {
      console.error(`[baileys] Failed to recover session for ${baseIdentity}:`, cleanupErr);
    } finally {
      this.recoveringJids.delete(baseIdentity);
    }
  }

  private baseSessionIdentity(jid: string): string {
    const bare = jid.split('@')[0] || '';
    return bare.replace(/:\d+$/, '');
  }
}
