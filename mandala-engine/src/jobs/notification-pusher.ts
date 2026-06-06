/**
 * Notification Pusher — delivers pending owner notifications
 * (social escalations + billing reminders) to the owner's WhatsApp,
 * EXACTLY ONCE each.
 *
 * SAFETY MODEL (anti-spam, strict idempotency):
 *   - CLAIM-BEFORE-SEND: each row is atomically flipped
 *     `wa_push_pending` true → false (guarded on the value still being
 *     true) BEFORE any send is attempted. The claim only succeeds for the
 *     ONE caller that observes the row still pending. If a crash/retry
 *     happens after claiming, the row is already non-pending, so it can
 *     NEVER be re-queried and re-sent. Worst case: a message is missed,
 *     never duplicated.
 *   - LIMIT 10 rows/run.
 *   - On send error we DO NOT un-claim (avoids spam loops); the error is
 *     logged. A claimed-but-unsent row simply won't be retried.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../memory/supabase-client.js';
import { WhatsAppAdapter } from '../channels/whatsapp.js';

export interface PushResult {
  pushed: number;
  skipped: number;
  errors: string[];
}

export interface PushDeps {
  db?: SupabaseClient;
  waManager?: WhatsAppAdapter;
}

interface NotificationRow {
  id: string;
  tenant_id: string;
  type: string;
  title: string | null;
  body: string | null;
  metadata: Record<string, any> | null;
}

const BATCH_LIMIT = 10;

/**
 * Resolve the owner WhatsApp number for a tenant, querying mandala_tenants
 * directly (same source flagOwner's owner.whatsapp ultimately comes from).
 * Prefers owner_whatsapp, falls back to business_whatsapp.
 */
async function resolveOwnerNumber(
  db: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await db
    .from('mandala_tenants')
    .select('owner_whatsapp, business_whatsapp')
    .eq('id', tenantId)
    .single();

  if (error || !data) return null;
  const num = (data.owner_whatsapp || data.business_whatsapp || '').toString().trim();
  return num.length > 0 ? num : null;
}

export async function pushPendingNotifications(deps: PushDeps = {}): Promise<PushResult> {
  const db = deps.db || getSupabase();
  const waManager = deps.waManager || WhatsAppAdapter.getInstance();

  const result: PushResult = { pushed: 0, skipped: 0, errors: [] };

  // 1. Fetch pending rows, oldest first.
  const { data: rows, error: queryErr } = await db
    .from('mandala_notifications')
    .select('id, tenant_id, type, title, body, metadata')
    .eq('metadata->>wa_push_pending', 'true')
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryErr) {
    result.errors.push(`query: ${queryErr.message}`);
    return result;
  }
  if (!rows || rows.length === 0) return result;

  for (const row of rows as NotificationRow[]) {
    const meta = { ...(row.metadata || {}) };
    const nowIso = new Date().toISOString();

    // 2. CLAIM FIRST — atomically flip wa_push_pending false, guarded on it
    //    still being 'true'. Only the caller whose update affects the row
    //    proceeds to send. This is the double-send guard.
    const claimedMeta = {
      ...meta,
      wa_push_pending: false,
      wa_push_claimed_at: nowIso,
    };

    const { data: claimed, error: claimErr } = await db
      .from('mandala_notifications')
      .update({ metadata: claimedMeta })
      .eq('id', row.id)
      .eq('metadata->>wa_push_pending', 'true') // guard: only if still pending
      .select('id');

    if (claimErr) {
      result.errors.push(`claim ${row.id}: ${claimErr.message}`);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      // Someone/something else already claimed it (or it's no longer pending).
      // Do NOT send.
      continue;
    }

    // 3. Resolve owner number. If none → skip (leave claimed, don't retry forever).
    let ownerNumber: string | null = null;
    try {
      ownerNumber = await resolveOwnerNumber(db, row.tenant_id);
    } catch (err: any) {
      result.errors.push(`resolve ${row.id}: ${err?.message || err}`);
    }

    if (!ownerNumber) {
      result.skipped++;
      console.log(`[notif-pusher] No owner number for tenant ${row.tenant_id} — skipped (notif ${row.id})`);
      continue;
    }

    // 4. Build the message: prefer suggested_text, else title + body.
    const suggested = (meta.suggested_text || '').toString().trim();
    const text = suggested.length > 0
      ? suggested
      : [row.title, row.body].filter(Boolean).join('\n').trim();

    if (!text) {
      result.skipped++;
      console.log(`[notif-pusher] Empty message body for notif ${row.id} — skipped`);
      continue;
    }

    // 5. Send via the same mechanism flagOwner uses: internal → owner,
    //    skipGuard=true (bypasses customer guard + rate limiter).
    try {
      const sent = await waManager.send(ownerNumber, text, 'mandala', true);
      if (sent) {
        result.pushed++;
        // mark wa_pushed_at — best-effort, does not affect idempotency.
        const pushedMeta = { ...claimedMeta, wa_pushed_at: new Date().toISOString() };
        await db
          .from('mandala_notifications')
          .update({ metadata: pushedMeta })
          .eq('id', row.id);
        console.log(`[notif-pusher] Pushed notif ${row.id} (type=${row.type}) to owner of tenant ${row.tenant_id}`);
      } else {
        // Send returned false — record, but DO NOT un-claim (avoid spam loop).
        result.errors.push(`send ${row.id}: send() returned false`);
        console.error(`[notif-pusher] send() returned false for notif ${row.id} (claimed, will not retry)`);
      }
    } catch (err: any) {
      result.errors.push(`send ${row.id}: ${err?.message || err}`);
      console.error(`[notif-pusher] Send error for notif ${row.id} (claimed, will not retry):`, err);
    }
  }

  return result;
}

/**
 * NotificationPusherScheduler — periodic runner, mirrors HunterScheduler.
 * Env-gated by NOTIF_PUSH_ENABLED (default 'true').
 * Interval via NOTIF_PUSH_INTERVAL_SECONDS (default 60s).
 */
export class NotificationPusherScheduler {
  private static instance: NotificationPusherScheduler;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  static getInstance(): NotificationPusherScheduler {
    if (!NotificationPusherScheduler.instance) {
      NotificationPusherScheduler.instance = new NotificationPusherScheduler();
    }
    return NotificationPusherScheduler.instance;
  }

  start(): void {
    const enabled = (process.env.NOTIF_PUSH_ENABLED || 'true') === 'true';
    if (!enabled) {
      console.log('[notif-pusher] Disabled (NOTIF_PUSH_ENABLED != true)');
      return;
    }

    const intervalSeconds = parseInt(process.env.NOTIF_PUSH_INTERVAL_SECONDS || '60');
    const intervalMs = Math.max(30, intervalSeconds) * 1000;

    console.log(`[notif-pusher] Starting — runs every ${intervalMs / 1000}s`);

    // Warmup delay so WA session + services are ready before first run.
    setTimeout(() => this.runCycle(), 45000);
    this.timer = setInterval(() => this.runCycle(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[notif-pusher] Stopped');
    }
  }

  async runCycle(): Promise<void> {
    if (this.running) return; // never overlap runs
    this.running = true;
    try {
      const res = await pushPendingNotifications();
      if (res.pushed > 0 || res.skipped > 0 || res.errors.length > 0) {
        console.log(
          `[notif-pusher] Cycle: pushed=${res.pushed} skipped=${res.skipped} errors=${res.errors.length}`
        );
        if (res.errors.length > 0) console.error('[notif-pusher] errors:', res.errors);
      }
    } catch (err) {
      // Must never crash the process.
      console.error('[notif-pusher] Cycle error (guarded):', err);
    } finally {
      this.running = false;
    }
  }
}
