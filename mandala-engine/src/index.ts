import { serve } from '@hono/node-server';
import { app } from './routes/index.js';
import { TenantManager } from './tenants/manager.js';
import { HandoffTimer } from './queue/handoff-timer.js';
import { HunterScheduler } from './hunter/scheduler.js';
import { BaileysProvider } from './channels/baileys-provider.js';
import { MessageRouter } from './channels/router.js';

const PORT = parseInt(process.env.PORT || '3100');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

  // Connect Baileys WhatsApp
  const baileys = BaileysProvider.getInstance();
  const router = MessageRouter.getInstance();

  // Bridge Baileys incoming messages → MessageRouter
  baileys.on('message', (msg) => {
    router.handleIncoming({
      channel: 'whatsapp',
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
      raw: msg.raw,
    }).catch(err => console.error('[baileys→router] Error:', err));
  });

  await baileys.connect();
  console.log('✓ Baileys WhatsApp provider initialized');

  // Start HTTP server
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`✓ Engine running on http://localhost:${info.port}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Endpoints:');
    console.log('  - POST /webhook/whatsapp       (WhatsApp fallback webhook)');
    console.log('  - POST /webhook/telegram       (Telegram incoming)');
    console.log('  - GET  /api/conversations      (List conversations)');
    console.log('  - GET  /api/leads              (Lead pipeline)');
    console.log('  - GET  /api/hunter/prospects    (Hunter prospects)');
    console.log('  - POST /api/hunter/run          (Trigger hunter)');
    console.log('  - POST /api/tasks              (Create task)');
    console.log('  - GET  /api/tasks              (List tasks)');
    console.log('  - GET  /api/tasks/:id          (Get task)');
    console.log('  - POST /api/tasks/:id/approve  (Approve task)');
    console.log('  - POST /api/tasks/:id/cancel   (Cancel task)');
    console.log('  - GET  /health                 (Health check)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
}

main().catch(console.error);
