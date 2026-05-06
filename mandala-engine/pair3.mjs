import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";

const versions = [
  [2, 3000, 1034074495],
  [2, 3000, 1033893291],
  [2, 3000, 1027934701],
];

let versionIndex = 0;

async function tryConnect() {
  const version = versions[versionIndex];
  console.log("\nTrying WA version:", version.join("."));
  
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ["Chrome", "Windows", "110.0.5481.177"],
    connectTimeoutMs: 60000,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n========================================");
      console.log("  QR CODE ABOVE — SCAN NOW!");
      console.log("  WhatsApp > Linked Devices > Link");
      console.log("  Version:", version.join("."));
      console.log("========================================\n");
    }
    if (connection === "open") {
      console.log("\n✅ PAIRED! Version", version.join("."), "works!");
      console.log("Now run: pm2 restart mandala-engine\n");
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("Closed. Status:", code);
      
      if (code === 405 || code === 428) {
        versionIndex++;
        if (versionIndex < versions.length) {
          console.log("Trying next version in 5s...");
          setTimeout(async () => {
            await tryConnect();
          }, 5000);
        } else {
          console.log("\nAll versions failed. WA may need longer cooldown.");
          process.exit(1);
        }
      } else if (code !== DisconnectReason.loggedOut) {
        console.log("Reconnecting in 5s...");
        setTimeout(async () => { await tryConnect(); }, 5000);
      }
    }
  });
}

// Clean start
import { rmSync } from "fs";
try { rmSync("./auth_info", { recursive: true }); } catch {}

console.log("Starting WA pairing with version rotation...");
await tryConnect();
