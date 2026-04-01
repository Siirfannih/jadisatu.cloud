import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webhookRoutes } from './webhooks.js';
import { apiRoutes } from './api.js';
import { taskRoutes } from './task-api.js';
import { waRoutes } from './wa-api.js';
import { tenantRoutes } from './tenant-api.js';

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

// Task engine routes
app.route('/api/tasks', taskRoutes);

// WhatsApp session management routes
app.route('/api/wa', waRoutes);

// Tenant management routes
app.route('/api/tenants', tenantRoutes);
