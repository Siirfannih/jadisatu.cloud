/**
 * BaileysManager — Multi-tenant WhatsApp session manager.
 *
 * Manages a Map of BaileysSession instances, persists state to Supabase,
 * and provides a unified API for connect/disconnect/send per tenant.
 */
import { EventEmitter } from 'events';
import { BaileysSession, type BaileysMessage, type SessionState } from './baileys-session.js';
import { getSupabase } from '../memory/supabase-client.js';

const MAX_SESSIONS = parseInt(process.env.MAX_WA_SESSIONS || '10');

export class BaileysManager extends EventEmitter {
  private static instance: BaileysManager;
  private sessions = new Map<string, BaileysSession>();

  static getInstance(): BaileysManager {
    if (!BaileysManager.instance) {
      BaileysManager.instance = new BaileysManager();
    }
    return BaileysManager.instance;
  }

  /**
   * Start or reconnect a WhatsApp session for a tenant.
   */
  async startSession(tenantId: string): Promise<SessionState> {
    // Check if already running
    const existing = this.sessions.get(tenantId);
    if (existing && existing.isConnected()) {
      return existing.state;
    }

    // Check max sessions
    const activeCount = Array.from(this.sessions.values()).filter(s => s.isConnected()).length;
    if (activeCount >= MAX_SESSIONS && !existing) {
      throw new Error(`Max WhatsApp sessions reached (${MAX_SESSIONS}). Disconnect another session first.`);
    }

    // Create or reuse session
    const session = existing || new BaileysSession(tenantId);

    if (!existing) {
      this.wireSessionEvents(session);
      this.sessions.set(tenantId, session);
    }

    await session.connect();
    return session.state;
  }

  /**
   * Disconnect a tenant's WhatsApp session.
   */
  async disconnectSession(tenantId: string): Promise<void> {
    const session = this.sessions.get(tenantId);
    if (!session) return;

    await session.disconnect();
    this.sessions.delete(tenantId);

    // Persist disconnected state
    await this.persistState(tenantId, {
      tenantId,
      status: 'disconnected',
      disconnectedAt: new Date(),
    });
  }

  /**
   * Send a message through a tenant's WhatsApp session.
   */
  async send(tenantId: string, to: string, message: string): Promise<boolean> {
    const session = this.sessions.get(tenantId);
    if (!session || !session.isConnected()) {
      console.error(`[baileys-manager] No active session for tenant ${tenantId}`);
      return false;
    }
    return session.send(to, message);
  }

  /**
   * Send typing indicator through a tenant's session.
   */
  async sendTyping(tenantId: string, to: string): Promise<void> {
    const session = this.sessions.get(tenantId);
    if (session) await session.sendTyping(to);
  }

  /**
   * Get the current state of a tenant's session.
   */
  getSessionState(tenantId: string): SessionState | undefined {
    return this.sessions.get(tenantId)?.state;
  }

  /**
   * Check if a tenant has an active connection.
   */
  isConnected(tenantId: string): boolean {
    return this.sessions.get(tenantId)?.isConnected() || false;
  }

  /**
   * List all active session states.
   */
  listSessions(): SessionState[] {
    return Array.from(this.sessions.values()).map(s => s.state);
  }

  /**
   * On startup, restore sessions that were previously connected.
   */
  async restoreActiveSessions(): Promise<void> {
    try {
      const db = getSupabase();
      const { data } = await db
        .from('mandala_wa_sessions')
        .select('tenant_id')
        .eq('status', 'connected');

      if (!data || data.length === 0) {
        console.log('[baileys-manager] No previously connected sessions to restore');
        return;
      }

      console.log(`[baileys-manager] Restoring ${data.length} session(s)...`);

      for (const row of data) {
        try {
          await this.startSession(row.tenant_id);
        } catch (err) {
          console.error(`[baileys-manager] Failed to restore session for ${row.tenant_id}:`, err);
        }
      }
    } catch (err) {
      console.error('[baileys-manager] Failed to query active sessions:', err);
    }
  }

  /**
   * Wire events from a BaileysSession to this manager.
   */
  private wireSessionEvents(session: BaileysSession): void {
    const tenantId = session.tenantId;

    session.on('qr', (qr: string) => {
      this.persistState(tenantId, {
        tenantId,
        status: 'qr_pending',
        qrCode: qr,
        lastQrAt: new Date(),
      });
    });

    session.on('connected', (phoneNumber?: string) => {
      this.persistState(tenantId, {
        tenantId,
        status: 'connected',
        phoneNumber,
        connectedAt: new Date(),
      });
      this.emit('connected', tenantId, phoneNumber);
    });

    session.on('disconnected', () => {
      this.persistState(tenantId, {
        tenantId,
        status: 'disconnected',
        disconnectedAt: new Date(),
      });
      this.emit('disconnected', tenantId);
    });

    session.on('logged_out', () => {
      this.persistState(tenantId, {
        tenantId,
        status: 'logged_out',
        disconnectedAt: new Date(),
      });
      this.sessions.delete(tenantId);
      this.emit('logged_out', tenantId);
    });

    session.on('message', (msg: BaileysMessage) => {
      // Forward with tenantId so the router knows which tenant this belongs to
      this.emit('message', tenantId, msg);
    });
  }

  /**
   * Persist session state to Supabase mandala_wa_sessions table.
   */
  private async persistState(tenantId: string, state: Partial<SessionState>): Promise<void> {
    try {
      const db = getSupabase();
      const row: Record<string, unknown> = {
        tenant_id: tenantId,
        status: state.status,
        updated_at: new Date().toISOString(),
      };

      if (state.qrCode !== undefined) row.qr_code = state.qrCode;
      if (state.phoneNumber !== undefined) row.phone_number = state.phoneNumber;
      if (state.connectedAt) row.connected_at = state.connectedAt.toISOString();
      if (state.disconnectedAt) row.disconnected_at = state.disconnectedAt.toISOString();
      if (state.lastQrAt) row.last_qr_at = state.lastQrAt.toISOString();
      if (state.errorMessage !== undefined) row.error_message = state.errorMessage;

      // Clear QR code when connected/disconnected
      if (state.status === 'connected' || state.status === 'disconnected' || state.status === 'logged_out') {
        row.qr_code = null;
      }

      await db
        .from('mandala_wa_sessions')
        .upsert(row, { onConflict: 'tenant_id' });

    } catch (err) {
      console.error(`[baileys-manager] Failed to persist state for ${tenantId}:`, err);
    }
  }
}
