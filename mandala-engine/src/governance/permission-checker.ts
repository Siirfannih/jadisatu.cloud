// ============================================================
// Mandala Governance — Permission Checker
// Role-based access control for Mandala operations
// ============================================================

import { getSupabase } from '../memory/supabase-client.js';
import { ActionLogger } from './action-logger.js';
import type { MandalaRole, RoleAssignment } from '../types/governance.js';

// Permission matrix: what each role can do
const ROLE_PERMISSIONS: Record<MandalaRole, Set<string>> = {
  owner: new Set([
    'view_dashboard',
    'view_conversations',
    'view_action_log',
    'view_approvals',
    'view_config',
    'approve_action',
    'reject_action',
    'takeover_conversation',
    'release_conversation',
    'run_hunter',
    'edit_config',
    'manage_roles',
    'export_data',
  ]),
  operator: new Set([
    'view_dashboard',
    'view_conversations',
    'view_action_log',
    'view_approvals',
    'view_config',
    'approve_action',
    'reject_action',
    'takeover_conversation',
    'release_conversation',
  ]),
  viewer: new Set([
    'view_dashboard',
    'view_conversations',
    'view_action_log',
    'view_approvals',
    'view_config',
  ]),
};

export type Permission = keyof typeof ROLE_PERMISSIONS extends never
  ? string
  : string;

export class PermissionChecker {
  private static instance: PermissionChecker;
  private roleCache = new Map<string, { role: RoleAssignment; loadedAt: number }>();
  private logger = ActionLogger.getInstance();

  static getInstance(): PermissionChecker {
    if (!PermissionChecker.instance) {
      PermissionChecker.instance = new PermissionChecker();
    }
    return PermissionChecker.instance;
  }

  /**
   * Get the role for a user in a tenant. Returns null if no role assigned.
   */
  async getRole(tenantId: string, userId: string): Promise<RoleAssignment | null> {
    const cacheKey = `${tenantId}:${userId}`;
    const cached = this.roleCache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < 60_000) {
      return cached.role;
    }

    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    const role = data as RoleAssignment;
    this.roleCache.set(cacheKey, { role, loadedAt: Date.now() });
    return role;
  }

  /**
   * Check if a user has a specific permission.
   */
  async hasPermission(tenantId: string, userId: string, permission: string): Promise<boolean> {
    const role = await this.getRole(tenantId, userId);
    if (!role) return false;

    const permissions = ROLE_PERMISSIONS[role.role];
    return permissions?.has(permission) || false;
  }

  /**
   * Get all permissions for a user in a tenant.
   */
  async getPermissions(tenantId: string, userId: string): Promise<string[]> {
    const role = await this.getRole(tenantId, userId);
    if (!role) return [];

    const permissions = ROLE_PERMISSIONS[role.role];
    return permissions ? Array.from(permissions) : [];
  }

  /**
   * Assign a role to a user.
   */
  async assignRole(
    tenantId: string,
    userId: string,
    role: MandalaRole,
    grantedBy: string
  ): Promise<RoleAssignment | null> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_roles')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          role,
          granted_by: grantedBy,
        },
        { onConflict: 'tenant_id,user_id' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('[permission-checker] assignRole error:', error.message);
      return null;
    }

    // Invalidate cache
    this.roleCache.delete(`${tenantId}:${userId}`);

    // Audit log
    await this.logger.log({
      tenant_id: tenantId,
      action_type: 'role_changed',
      actor: 'owner',
      actor_id: grantedBy,
      summary: `Role "${role}" assigned to user ${userId}`,
      details: { user_id: userId, role, granted_by: grantedBy },
    });

    return data as RoleAssignment;
  }

  /**
   * Remove a user's role.
   */
  async removeRole(tenantId: string, userId: string, removedBy: string): Promise<boolean> {
    const db = getSupabase();
    const { error } = await db
      .from('mandala_roles')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (error) {
      console.error('[permission-checker] removeRole error:', error.message);
      return false;
    }

    this.roleCache.delete(`${tenantId}:${userId}`);

    await this.logger.log({
      tenant_id: tenantId,
      action_type: 'role_changed',
      actor: 'owner',
      actor_id: removedBy,
      summary: `Role removed for user ${userId}`,
      details: { user_id: userId, removed_by: removedBy },
    });

    return true;
  }

  /**
   * List all roles for a tenant.
   */
  async listRoles(tenantId: string): Promise<RoleAssignment[]> {
    const db = getSupabase();
    const { data, error } = await db
      .from('mandala_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[permission-checker] listRoles error:', error.message);
      return [];
    }

    return (data || []) as RoleAssignment[];
  }

  clearCache(): void {
    this.roleCache.clear();
  }
}
