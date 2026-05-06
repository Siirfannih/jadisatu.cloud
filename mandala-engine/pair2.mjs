import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';

console.log('Waiting 5 seconds before connecting...');
await new Promise(r => setTimeout(r, 5000));

const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

console.log('Connecting with Ubuntu browser fingerprint...');
const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
  browser: Browsers.ubuntu('Chrome'),
  connectTimeoutMs: 60000,
  retryRequestDelayMs: 5000,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    console.log('\n========================================');
    console.log('  QR CODE ABOVE — SCAN NOW!');
    console.log('  WhatsApp > Linked Devices > Link');
    console.log('========================================\n');
  }
  if (connection === 'open') {
    console.log('\n✅ PAIRED! Now run: pm2 restart mandala-engine\n');
  }
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    console.log('Closed:', code);
    if (code !== DisconnectReason.loggedOut && code !== 405) {
      console.log('Reconnecting in 10s...');
      setTimeout(() => process.exit(0), 10000);
    }
    if (code === 405) {
      console.log('\n405 - Still rate limited. Wait longer and try again.');
      process.exit(1);
    }
  }
});
