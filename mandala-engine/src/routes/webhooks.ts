import { Hono } from 'hono';
import { MessageRouter } from '../channels/router.js';
import type { WhatsAppWebhook, TelegramWebhook } from '../types/shared.js';

export const webhookRoutes = new Hono();

const router = MessageRouter.getInstance();

// WhatsApp incoming message webhook
webhookRoutes.post('/whatsapp', async (c) => {
  try {
    const body = await c.req.json<WhatsAppWebhook>();

    if (!body.sender || !body.message) {
      return c.json({ error: 'Missing sender or message' }, 400);
    }

    // Process asynchronously — don't block the webhook response
    router.handleIncoming({
      channel: 'whatsapp',
      sender: body.sender,
      content: body.message,
      timestamp: new Date(body.timestamp || Date.now()),
      raw: body,
    }).catch(err => console.error('[webhook/whatsapp] Error:', err));

    return c.json({ status: 'received' });
  } catch (err) {
    console.error('[webhook/whatsapp] Parse error:', err);
    return c.json({ error: 'Invalid payload' }, 400);
  }
});

// OpenClaw bridge — incoming messages forwarded from OpenClaw gateway
webhookRoutes.post('/openclaw', async (c) => {
  try {
    const body = await c.req.json();

    // OpenClaw forwards: { sender, message, channel, timestamp, message_id }
    const sender = body.sender || body.from;
    const message = body.message || body.text || body.content;
    const channel = body.channel || 'whatsapp';

    if (!sender || !message) {
      return c.json({ error: 'Missing sender or message' }, 400);
    }

    router.handleIncoming({
      channel: channel,
      sender: sender,
      content: message,
      timestamp: new Date(body.timestamp || Date.now()),
      raw: body,
    }).catch(err => console.error('[webhook/openclaw] Error:', err));

    return c.json({ status: 'received' });
  } catch (err) {
    console.error('[webhook/openclaw] Parse error:', err);
    return c.json({ error: 'Invalid payload' }, 400);
  }
});

// Telegram incoming message webhook
webhookRoutes.post('/telegram', async (c) => {
  try {
    const body = await c.req.json();
    const msg = body.message;

    if (!msg?.text || !msg?.from?.id) {
      return c.json({ status: 'ignored' });
    }

    const webhook: TelegramWebhook = {
      chat_id: msg.chat.id,
      from_id: msg.from.id,
      message: msg.text,
      timestamp: msg.date,
    };

    router.handleIncoming({
      channel: 'telegram',
      sender: String(webhook.from_id),
      content: webhook.message,
      timestamp: new Date(webhook.timestamp * 1000),
      raw: body,
    }).catch(err => console.error('[webhook/telegram] Error:', err));

    return c.json({ status: 'received' });
  } catch (err) {
    console.error('[webhook/telegram] Parse error:', err);
    return c.json({ error: 'Invalid payload' }, 400);
  }
});
