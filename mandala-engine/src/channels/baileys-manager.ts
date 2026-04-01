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
  private staleCleanupInterval?: ReturnType<typeof setInterval>;

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
   * Get QR code for a tenant with expiry information.
   * Checks in-memory session first, then Supabase fallback.
   */
  async getQrCode(tenantId: string): Promise<{
    qrCode: string | null;
    generatedAt: Date | null;
    expiresInMs: number;
    status: string;
  }> {
    const session = this.sessions.get(tenantId);

    if (session?.state.qrCode) {
      const qrAge = session.state.lastQrAt
        ? Date.now() - session.state.lastQrAt.getTime()
        : 0;
      return {
        qrCode: session.state.qrCode,
        generatedAt: session.state.lastQrAt || null,
        expiresInMs: Math.max(0, 90_000 - qrAge),
        status: session.state.status,
      };
    }

    // Supabase fallback
    const db = getSupabase();
    const { data } = await db
      .from('mandala_wa_sessions')
      .select('qr_code, last_qr_at, status')
      .eq('tenant_id', tenantId)
      .single();

    if (data?.qr_code) {
      const lastQrAt = data.last_qr_at ? new Date(data.last_qr_at) : null;
      const qrAge = lastQrAt ? Date.now() - lastQrAt.getTime() : 999_999;
      return {
        qrCode: data.qr_code,
        generatedAt: lastQrAt,
        expiresInMs: Math.max(0, 90_000 - qrAge),
        status: data.status,
      };
    }

    return {
      qrCode: null,
      generatedAt: null,
      expiresInMs: 0,
      status: session?.state.status || 'disconnected',
    };
  }

  /**
   * Start periodic cleanup of stale qr_pending sessions.
   * Sessions stuck in qr_pending for > 5 minutes are disconnected.
   */
  startStaleCleanup(intervalMs = 5 * 60_000): void {
    if (this.staleCleanupInterval) return;

    this.staleCleanupInterval = setInterval(async () => {
      try {
        const db = getSupabase();
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

        const { data: staleSessions } = await db
          .from('mandala_wa_sessions')
          .select('tenant_id')
          .eq('status', 'qr_pending')
          .lt('last_qr_at', fiveMinAgo);

        if (staleSessions && staleSessions.length > 0) {
          for (const row of staleSessions) {
            console.log(`[baileys-manager] Cleaning stale qr_pending session: ${row.tenant_id}`);
            try {
              await this.disconnectSession(row.tenant_id);
            } catch {
              // Force-update DB status if disconnect fails
              await db
                .from('mandala_wa_sessions')
                .update({ status: 'disconnected', qr_code: null, updated_at: new Date().toISOString() })
                .eq('tenant_id', row.tenant_id);
            }
          }
        }
      } catch (err) {
        console.error('[baileys-manager] Stale cleanup error:', err);
      }
    }, intervalMs);

    console.log('[baileys-manager] Stale session cleanup started (every 5 min)');
  }

  stopStaleCleanup(): void {
    if (this.staleCleanupInterval) {
      clearInterval(this.staleCleanupInterval);
      this.staleCleanupInterval = undefined;
    }
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
