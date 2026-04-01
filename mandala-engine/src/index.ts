import { serve } from '@hono/node-server';
import { app } from './routes/index.js';
import { TenantManager } from './tenants/manager.js';
import { HandoffTimer } from './queue/handoff-timer.js';
import { HunterScheduler } from './hunter/scheduler.js';
import { BaileysManager } from './channels/baileys-manager.js';
import { MessageRouter } from './channels/router.js';
import { WhatsAppAdapter } from './channels/whatsapp.js';

const PORT = parseInt(process.env.PORT || '3100');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Mandala Engine — Starting...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Load all tenant configs
  const tenantManager = TenantManager.getInstance();
  await tenantManager.loadAll();
  console.log(`✓ Loaded ${tenantManager.count()} tenant(s)`);

  // Initialize handoff timer system
  const handoffTimer = HandoffTimer.getInstance();
  handoffTimer.start();
  console.log('✓ Handoff timer system started');

  // Initialize hunter scheduler
  const hunterScheduler = HunterScheduler.getInstance();
  hunterScheduler.start();
  console.log('✓ Hunter scheduler initialized');

  // Connect WhatsApp via BaileysManager (multi-tenant)
  const baileysManager = BaileysManager.getInstance();
  const router = MessageRouter.getInstance();

  // Wire BaileysManager into WhatsAppAdapter so outbound messages use Baileys
  WhatsAppAdapter.getInstance().setBaileysManager(baileysManager);

  // Bridge BaileysManager incoming messages → MessageRouter (with tenantId)
  baileysManager.on('message', (tenantId: string, msg: any) => {
    router.handleIncoming({
      channel: 'whatsapp',
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
      raw: msg.raw,
      tenantId,
    }).catch(err => console.error('[baileys→router] Error:', err));
  });

  // Start default 'mandala' session
  await baileysManager.startSession('mandala');
  console.log('✓ Baileys WhatsApp — mandala session started');

  // Restore any other previously-connected sessions
  await baileysManager.restoreActiveSessions();
  console.log('✓ Baileys WhatsApp — active sessions restored');

  // Start stale session cleanup (qr_pending > 5min → disconnect)
  baileysManager.startStaleCleanup();
  console.log('✓ Stale session cleanup started');

  // Start HTTP server
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`✓ Engine running on http://localhost:${info.port}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Endpoints:');
    console.log('  - POST /webhook/whatsapp          (WhatsApp fallback webhook)');
    console.log('  - POST /webhook/telegram          (Telegram incoming)');
    console.log('  - GET  /api/conversations         (List conversations)');
    console.log('  - POST /api/conversations/:id/close (Close + learn)');
    console.log('  - GET  /api/leads                 (Lead pipeline)');
    console.log('  - GET  /api/hunter/prospects       (Hunter prospects)');
    console.log('  - POST /api/hunter/run             (Trigger hunter)');
    console.log('  - POST /api/tasks                 (Create task + analyze)');
    console.log('  - GET  /api/tasks                 (List tasks)');
    console.log('  - GET  /api/tasks/:id/plan         (View execution plan)');
    console.log('  - POST /api/tasks/:id/approve-plan (Approve plan)');
    console.log('  - POST /api/tasks/:id/reject-plan  (Reject plan + feedback)');
    console.log('  - POST /api/wa/connect/:tenantId   (Start WA session)');
    console.log('  - GET  /api/wa/qr/:tenantId        (Get QR code)');
    console.log('  - GET  /api/wa/status/:tenantId    (WA session status)');
    console.log('  - POST /api/wa/disconnect/:tenantId (Stop WA session)');
    console.log('  - GET  /api/wa/sessions            (List all WA sessions)');
    console.log('  - POST /api/tenants               (Create tenant)');
    console.log('  - GET  /api/tenants               (List tenants)');
    console.log('  - GET  /health                    (Health check)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
}

main().catch(console.error);
