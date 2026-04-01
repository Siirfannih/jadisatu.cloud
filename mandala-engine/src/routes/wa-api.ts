/**
 * WA Session Management API Routes
 *
 * Provides REST endpoints for managing WhatsApp Baileys sessions per tenant.
 * Enables self-service QR code generation and connection for multi-tenant onboarding.
 */
import { Hono } from 'hono';
import { BaileysManager } from '../channels/baileys-manager.js';
import { TenantManager } from '../tenants/manager.js';
import { getSupabase } from '../memory/supabase-client.js';

export const waRoutes = new Hono();

const baileysManager = BaileysManager.getInstance();
const tenantManager = TenantManager.getInstance();

// ══════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════

/**
 * POST /wa/connect/:tenantId
 * Start a WhatsApp session for a tenant. If not connected, initiates QR generation.
 */
waRoutes.post('/connect/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');

  // Verify tenant exists
  const tenant = tenantManager.get(tenantId);
  if (!tenant) {
    // Also check Supabase for dynamically created tenants
    const db = getSupabase();
    const { data } = await db
      .from('mandala_tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('active', true)
      .single();

    if (!data) {
      return c.json({ error: `Tenant not found: ${tenantId}` }, 404);
    }
  }

  try {
    const state = await baileysManager.startSession(tenantId);
    return c.json({
      tenant_id: tenantId,
      status: state.status,
      phone_number: state.phoneNumber,
      message: state.status === 'connected'
        ? 'Already connected'
        : 'Session started — poll GET /api/wa/qr/:tenantId for QR code',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /wa/qr/:tenantId
 * Get the current QR code for a tenant's session.
 * Returns QR string + expiry info for frontend display.
 */
waRoutes.get('/qr/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');

  // Try in-memory session first (fastest)
  const state = baileysManager.getSessionState(tenantId);

  if (state?.qrCode) {
    const qrAge = state.lastQrAt
      ? Date.now() - state.lastQrAt.getTime()
      : 0;
    const expiresInMs = Math.max(0, 90_000 - qrAge); // QR expires in ~90s

    return c.json({
      tenant_id: tenantId,
      status: state.status,
      qr_code: state.qrCode,
      generated_at: state.lastQrAt?.toISOString(),
      expires_in_ms: expiresInMs,
      expired: expiresInMs <= 0,
    });
  }

  // If session is connected, no QR needed
  if (state?.status === 'connected') {
    return c.json({
      tenant_id: tenantId,
      status: 'connected',
      phone_number: state.phoneNumber,
      qr_code: null,
      message: 'Session already connected — no QR needed',
    });
  }

  // Fallback: check Supabase for persisted QR
  const db = getSupabase();
  const { data } = await db
    .from('mandala_wa_sessions')
    .select('status, qr_code, last_qr_at, phone_number')
    .eq('tenant_id', tenantId)
    .single();

  if (data?.qr_code) {
    const lastQrAt = data.last_qr_at ? new Date(data.last_qr_at) : null;
    const qrAge = lastQrAt ? Date.now() - lastQrAt.getTime() : 999_999;
    const expiresInMs = Math.max(0, 90_000 - qrAge);

    return c.json({
      tenant_id: tenantId,
      status: data.status,
      qr_code: data.qr_code,
      generated_at: data.last_qr_at,
      expires_in_ms: expiresInMs,
      expired: expiresInMs <= 0,
    });
  }

  return c.json({
    tenant_id: tenantId,
    status: state?.status || data?.status || 'disconnected',
    qr_code: null,
    message: 'No QR available. Call POST /api/wa/connect/:tenantId first.',
  });
});

/**
 * GET /wa/status/:tenantId
 * Get the current connection status of a tenant's WhatsApp session.
 */
waRoutes.get('/status/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');

  // In-memory state first
  const state = baileysManager.getSessionState(tenantId);
  if (state) {
    return c.json({
      tenant_id: tenantId,
      status: state.status,
      phone_number: state.phoneNumber,
      connected_at: state.connectedAt?.toISOString(),
      disconnected_at: state.disconnectedAt?.toISOString(),
      has_qr: !!state.qrCode,
      error: state.errorMessage,
    });
  }

  // Fallback: Supabase
  const db = getSupabase();
  const { data } = await db
    .from('mandala_wa_sessions')
    .select('status, phone_number, connected_at, disconnected_at, error_message')
    .eq('tenant_id', tenantId)
    .single();

  if (data) {
    return c.json({
      tenant_id: tenantId,
      status: data.status,
      phone_number: data.phone_number,
      connected_at: data.connected_at,
      disconnected_at: data.disconnected_at,
      has_qr: false,
      error: data.error_message,
    });
  }

  return c.json({
    tenant_id: tenantId,
    status: 'not_initialized',
    message: 'No session found for this tenant',
  });
});

/**
 * POST /wa/disconnect/:tenantId
 * Disconnect a tenant's WhatsApp session.
 */
waRoutes.post('/disconnect/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');

  try {
    await baileysManager.disconnectSession(tenantId);
    return c.json({
      tenant_id: tenantId,
      status: 'disconnected',
      message: 'Session disconnected successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /wa/sessions
 * List all active WhatsApp sessions and their states.
 */
waRoutes.get('/sessions', async (c) => {
  const inMemorySessions = baileysManager.listSessions();

  // Also get persisted sessions from Supabase for tenants not in memory
  const db = getSupabase();
  const { data: dbSessions } = await db
    .from('mandala_wa_sessions')
    .select('tenant_id, status, phone_number, connected_at, disconnected_at, last_qr_at')
    .order('updated_at', { ascending: false });

  // Merge: in-memory takes precedence
  const inMemoryIds = new Set(inMemorySessions.map(s => s.tenantId));
  const sessions = [
    ...inMemorySessions.map(s => ({
      tenant_id: s.tenantId,
      status: s.status,
      phone_number: s.phoneNumber,
      connected_at: s.connectedAt?.toISOString(),
      has_qr: !!s.qrCode,
      source: 'live' as const,
    })),
    ...(dbSessions || [])
      .filter(s => !inMemoryIds.has(s.tenant_id))
      .map(s => ({
        tenant_id: s.tenant_id,
        status: s.status,
        phone_number: s.phone_number,
        connected_at: s.connected_at,
        has_qr: false,
        source: 'persisted' as const,
      })),
  ];

  return c.json({ sessions, total: sessions.length });
});
