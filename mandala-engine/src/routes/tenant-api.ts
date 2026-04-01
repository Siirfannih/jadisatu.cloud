/**
 * Tenant Management API Routes
 *
 * CRUD operations for dynamic tenant configuration.
 * Allows creating new tenants via API instead of YAML files only.
 */
import { Hono } from 'hono';
import { getSupabase } from '../memory/supabase-client.js';
import { TenantManager } from '../tenants/manager.js';
import { BaileysManager } from '../channels/baileys-manager.js';

export const tenantRoutes = new Hono();

const tenantManager = TenantManager.getInstance();
const baileysManager = BaileysManager.getInstance();

/**
 * POST /tenants
 * Create a new tenant. Persists to Supabase and loads into memory.
 */
tenantRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { id, name, owner_name, owner_whatsapp, type } = body;

  if (!id || !name) {
    return c.json({ error: 'Missing required fields: id, name' }, 400);
  }

  // Check for duplicates
  if (tenantManager.get(id)) {
    return c.json({ error: `Tenant already exists: ${id}` }, 409);
  }

  const db = getSupabase();
  const row: Record<string, unknown> = {
    id,
    name,
    type: type || 'client',
    active: true,
    owner_name: owner_name || null,
    owner_whatsapp: owner_whatsapp || null,
  };

  // Optional config overrides
  if (body.ai_config) row.ai_config = body.ai_config;
  if (body.channel_config) row.channel_config = body.channel_config;
  if (body.routing_config) row.routing_config = body.routing_config;
  if (body.handoff_config) row.handoff_config = body.handoff_config;
  if (body.knowledge_paths) row.knowledge_paths = body.knowledge_paths;
  if (body.owner_timezone) row.owner_timezone = body.owner_timezone;

  const { error } = await db
    .from('mandala_tenants')
    .insert(row);

  if (error) {
    return c.json({ error: `Failed to create tenant: ${error.message}` }, 500);
  }

  // Reload tenants (now includes Supabase)
  await tenantManager.loadAll();

  return c.json({
    tenant: { id, name, type: row.type, active: true },
    message: 'Tenant created. Call POST /api/wa/connect/:tenantId to start WhatsApp session.',
  }, 201);
});

/**
 * GET /tenants
 * List all tenants (YAML + Supabase combined).
 */
tenantRoutes.get('/', async (c) => {
  const tenants = tenantManager.list();

  // Enrich with session status
  const enriched = tenants.map(t => {
    const state = baileysManager.getSessionState(t.id);
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      active: t.active,
      owner_name: t.owner?.name,
      wa_status: state?.status || 'not_initialized',
      wa_phone: state?.phoneNumber,
    };
  });

  return c.json({ tenants: enriched, total: enriched.length });
});

/**
 * GET /tenants/:id
 * Get detailed tenant config + session status.
 */
tenantRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const tenant = tenantManager.get(id);

  if (!tenant) {
    return c.json({ error: `Tenant not found: ${id}` }, 404);
  }

  const state = baileysManager.getSessionState(id);

  return c.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      type: tenant.type,
      active: tenant.active,
      owner: tenant.owner,
      ai: tenant.ai,
      channels: tenant.channels,
      knowledge: tenant.knowledge,
    },
    wa_session: state ? {
      status: state.status,
      phone_number: state.phoneNumber,
      connected_at: state.connectedAt?.toISOString(),
      has_qr: !!state.qrCode,
    } : null,
  });
});

/**
 * PATCH /tenants/:id
 * Update a dynamically-created tenant's config.
 */
tenantRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const db = getSupabase();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.active !== undefined) updates.active = body.active;
  if (body.owner_name !== undefined) updates.owner_name = body.owner_name;
  if (body.owner_whatsapp !== undefined) updates.owner_whatsapp = body.owner_whatsapp;
  if (body.ai_config !== undefined) updates.ai_config = body.ai_config;
  if (body.channel_config !== undefined) updates.channel_config = body.channel_config;
  if (body.routing_config !== undefined) updates.routing_config = body.routing_config;
  if (body.handoff_config !== undefined) updates.handoff_config = body.handoff_config;
  if (body.knowledge_paths !== undefined) updates.knowledge_paths = body.knowledge_paths;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  const { error } = await db
    .from('mandala_tenants')
    .update(updates)
    .eq('id', id);

  if (error) {
    return c.json({ error: `Failed to update tenant: ${error.message}` }, 500);
  }

  // Reload tenants
  await tenantManager.loadAll();

  return c.json({ message: `Tenant ${id} updated`, updated_fields: Object.keys(updates) });
});

/**
 * DELETE /tenants/:id
 * Soft-delete: set active=false. Does NOT delete data.
 */
tenantRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Don't allow deleting the primary mandala tenant
  if (id === 'mandala') {
    return c.json({ error: 'Cannot delete the primary mandala tenant' }, 403);
  }

  const db = getSupabase();
  const { error } = await db
    .from('mandala_tenants')
    .update({ active: false })
    .eq('id', id);

  if (error) {
    return c.json({ error: `Failed to deactivate tenant: ${error.message}` }, 500);
  }

  // Disconnect WA session if active
  try {
    await baileysManager.disconnectSession(id);
  } catch { /* ignore if not connected */ }

  // Reload tenants
  await tenantManager.loadAll();

  return c.json({ message: `Tenant ${id} deactivated`, active: false });
});
