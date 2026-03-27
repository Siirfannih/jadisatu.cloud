import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webhookRoutes } from './webhooks.js';
import { apiRoutes } from './api.js';
import { governanceRoutes } from './governance.js';

export const app = new Hono();

// Middleware
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'mandala-engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Webhook routes (WhatsApp, Telegram)
app.route('/webhook', webhookRoutes);

// API routes (Dashboard, management)
app.route('/api', apiRoutes);

// Governance routes (Safety, Permissions, Audit, Observability)
app.route('/api/governance', governanceRoutes);
