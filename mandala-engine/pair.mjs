/**
 * Standalone WA pairing script
 * Run: node pair.mjs
 * After paired, auth_info/ will have the session — mandala-engine can use it
 */
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
  browser: ['Mandala Engine', 'Chrome', '120.0.0'],
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║  QR CODE ABOVE — SCAN WITH WHATSAPP  ║');
    console.log('║  Settings > Linked Devices > Link     ║');
    console.log('╚══════════════════════════════════════╝\n');
  }
  
  if (connection === 'open') {
    console.log('\n✅ CONNECTED! WhatsApp paired successfully.');
    console.log('Auth saved to ./auth_info/');
    console.log('Now run: pm2 restart mandala-engine');
    console.log('Press Ctrl+C to exit.\n');
  }
  
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    console.log('Connection closed. Status:', code);
    if (code === DisconnectReason.loggedOut) {
      console.log('Logged out. Run this script again.');
      process.exit(1);
    }
    // Don't auto-reconnect during pairing — let user see what's happening
    if (code === 405) {
      console.log('\n⚠️  405 = WA rejected. Waiting 30s before retry...');
      console.log('   (Too many attempts — WA rate limiting)\n');
      setTimeout(() => {
        console.log('Retrying...');
        process.exit(0); // Exit and let user re-run manually
      }, 30000);
    }
  }
});
