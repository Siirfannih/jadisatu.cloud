import { serve } from '@hono/node-server';
import { app } from './routes/index.js';
import { TenantManager } from './tenants/manager.js';
import { HandoffTimer } from './queue/handoff-timer.js';
import { HunterScheduler } from './hunter/scheduler.js';

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

  // Start HTTP server
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`✓ Engine running on http://localhost:${info.port}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Endpoints:');
    console.log('  - POST /webhook/whatsapp       (WhatsApp incoming)');
    console.log('  - POST /webhook/openclaw       (OpenClaw bridge)');
    console.log('  - POST /webhook/telegram       (Telegram incoming)');
    console.log('  - GET  /api/conversations      (List conversations)');
    console.log('  - GET  /api/leads              (Lead pipeline)');
    console.log('  - GET  /api/hunter/prospects    (Hunter prospects)');
    console.log('  - POST /api/hunter/run          (Trigger hunter)');
    console.log('  - GET  /api/governance/observability (Observability)');
    console.log('  - GET  /api/governance/config   (Governance config)');
    console.log('  - GET  /api/governance/approvals (Approval queue)');
    console.log('  - GET  /api/governance/action-log (Audit trail)');
    console.log('  - GET  /api/governance/roles    (Role management)');
    console.log('  - GET  /health                 (Health check)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
}

main().catch(console.error);
