// ============================================================
// Mandala Governance — API Routes
// Issue #23: Safety, Governance, Permissions, Observability
// ============================================================

import { Hono } from 'hono';
import { ActionLogger } from '../governance/action-logger.js';
import { PolicyEngine } from '../governance/policy-engine.js';
import { ApprovalQueue } from '../governance/approval-queue.js';
import { PermissionChecker } from '../governance/permission-checker.js';
import { ObservabilityService } from '../governance/observability.js';
import type { MandalaRole } from '../types/governance.js';

export const governanceRoutes = new Hono();

const logger = ActionLogger.getInstance();
const policyEngine = PolicyEngine.getInstance();
const approvalQueue = ApprovalQueue.getInstance();
const permissionChecker = PermissionChecker.getInstance();
const observability = ObservabilityService.getInstance();

// ══════════════════════════════════════════
// OBSERVABILITY
// ══════════════════════════════════════════

// Full observability snapshot
governanceRoutes.get('/observability', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const snapshot = await observability.getSnapshot(tenant);
  return c.json({ observability: snapshot });
});

// ══════════════════════════════════════════
// GOVERNANCE CONFIG
// ══════════════════════════════════════════

// Get governance config for tenant
governanceRoutes.get('/config', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const config = await policyEngine.getConfig(tenant);
  return c.json({ config });
});

// Update governance config
governanceRoutes.put('/config', async (c) => {
  const body = await c.req.json();
  const tenant = body.tenant_id || 'mandala';
  const actorId = body.actor_id || 'api';

  const { tenant_id: _t, actor_id: _a, ...updates } = body;
  const config = await policyEngine.updateConfig(tenant, updates, actorId);
  return c.json({ config });
});

// ══════════════════════════════════════════
// ACTION LOG (Audit Trail)
// ══════════════════════════════════════════

// Get recent action log entries
governanceRoutes.get('/action-log', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const actionType = c.req.query('action_type') as string | undefined;
  const conversationId = c.req.query('conversation_id') as string | undefined;
  const unreviewedOnly = c.req.query('unreviewed_only') === 'true';

  const entries = await logger.getRecent(tenant, {
    limit,
    action_type: actionType as any,
    conversation_id: conversationId,
    unreviewed_only: unreviewedOnly,
  });

  return c.json({ entries, count: entries.length });
});

// Mark action log entry as reviewed
governanceRoutes.post('/action-log/:id/review', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { reviewed_by, outcome } = body;

  if (!reviewed_by || !outcome) {
    return c.json({ error: 'Missing reviewed_by or outcome' }, 400);
  }

  await logger.markReviewed(id, reviewed_by, outcome);
  return c.json({ status: 'reviewed', id, outcome });
});

// ══════════════════════════════════════════
// APPROVAL QUEUE
// ══════════════════════════════════════════

// Get pending approvals
governanceRoutes.get('/approvals', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const status = c.req.query('status') || 'pending';

  if (status === 'pending') {
    const items = await approvalQueue.getPending(tenant);
    return c.json({ approvals: items, count: items.length });
  }

  const items = await approvalQueue.getRecent(tenant);
  return c.json({ approvals: items, count: items.length });
});

// Approve an action
governanceRoutes.post('/approvals/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { resolved_by, note } = body;

  if (!resolved_by) {
    return c.json({ error: 'Missing resolved_by' }, 400);
  }

  const item = await approvalQueue.approve(id, resolved_by, note);
  if (!item) {
    return c.json({ error: 'Approval not found or already resolved' }, 404);
  }

  return c.json({ status: 'approved', approval: item });
});

// Reject an action
governanceRoutes.post('/approvals/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { resolved_by, note } = body;

  if (!resolved_by) {
    return c.json({ error: 'Missing resolved_by' }, 400);
  }

  const item = await approvalQueue.reject(id, resolved_by, note);
  if (!item) {
    return c.json({ error: 'Approval not found or already resolved' }, 404);
  }

  return c.json({ status: 'rejected', approval: item });
});

// ══════════════════════════════════════════
// ROLES & PERMISSIONS
// ══════════════════════════════════════════

// List roles for tenant
governanceRoutes.get('/roles', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';
  const roles = await permissionChecker.listRoles(tenant);
  return c.json({ roles });
});

// Assign role
governanceRoutes.post('/roles', async (c) => {
  const body = await c.req.json();
  const { tenant_id, user_id, role, granted_by } = body;

  if (!user_id || !role || !granted_by) {
    return c.json({ error: 'Missing user_id, role, or granted_by' }, 400);
  }

  const validRoles: MandalaRole[] = ['owner', 'operator', 'viewer'];
  if (!validRoles.includes(role)) {
    return c.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400);
  }

  const assignment = await permissionChecker.assignRole(
    tenant_id || 'mandala',
    user_id,
    role,
    granted_by
  );

  if (!assignment) {
    return c.json({ error: 'Failed to assign role' }, 500);
  }

  return c.json({ role: assignment });
});

// Remove role
governanceRoutes.delete('/roles/:userId', async (c) => {
  const userId = c.req.param('userId');
  const tenant = c.req.query('tenant') || 'mandala';
  const removedBy = c.req.query('removed_by') || 'api';

  const success = await permissionChecker.removeRole(tenant, userId, removedBy);
  return c.json({ status: success ? 'removed' : 'failed' });
});

// Check permissions for a user
governanceRoutes.get('/permissions/:userId', async (c) => {
  const userId = c.req.param('userId');
  const tenant = c.req.query('tenant') || 'mandala';

  const role = await permissionChecker.getRole(tenant, userId);
  const permissions = await permissionChecker.getPermissions(tenant, userId);

  return c.json({
    user_id: userId,
    tenant_id: tenant,
    role: role?.role || null,
    permissions,
  });
});

// ══════════════════════════════════════════
// POLICY CHECK (for testing/debugging)
// ══════════════════════════════════════════

// Evaluate a policy decision without executing
governanceRoutes.post('/policy/evaluate', async (c) => {
  const body = await c.req.json();
  const { tenant_id, action_type, conversation_id, target } = body;

  if (!action_type) {
    return c.json({ error: 'Missing action_type' }, 400);
  }

  const decision = await policyEngine.evaluate(
    tenant_id || 'mandala',
    action_type,
    { conversation_id, target }
  );

  return c.json({ decision });
});

// Check rate limits
governanceRoutes.get('/rate-limits', async (c) => {
  const tenant = c.req.query('tenant') || 'mandala';

  const [messages, conversations, hunterContacts] = await Promise.all([
    policyEngine.checkRateLimit(tenant, 'message_sent'),
    policyEngine.checkRateLimit(tenant, 'conversation_created'),
    policyEngine.checkRateLimit(tenant, 'hunter_contact'),
  ]);

  return c.json({
    rate_limits: {
      messages_per_hour: messages,
      conversations_per_day: conversations,
      hunter_contacts_per_day: hunterContacts,
    },
  });
});
