const fs = require('fs');
const path = require('path');

// Load .env file as key=value pairs (ignores comments and blank lines)
function loadEnv(envPath) {
  const vars = {};
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch (_) { /* .env not found — ok */ }
  return vars;
}

module.exports = {
  apps: [
    // NOTE: the legacy "jadisatu-nextjs" app (cwd ./nextjs-app, port 3000) was
    // removed — it is dead (nextjs-app is gone) and crash-looped on :3000,
    // stealing the port from the live web (jadisatu-v2-web at /root/jadisatu-v2,
    // managed separately). Do NOT re-add it here.
    {
      name: "hunter-agent",
      cwd: "./hunter-agent/backend",
      script: "/usr/local/bin/uvicorn",
      args: "api:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      env: {
        PORT: 8000,
        ...loadEnv(path.resolve(__dirname, 'hunter-agent/backend/.env'))
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/root/.pm2/logs/hunter-agent-error.log",
      out_file: "/root/.pm2/logs/hunter-agent-out.log"
    },
    {
      name: "mandala-engine",
      cwd: "./mandala-engine",
      script: "node",
      args: "dist/index.js",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
        ...loadEnv(path.resolve(__dirname, 'mandala-engine/.env'))
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/root/.pm2/logs/mandala-engine-error.log",
      out_file: "/root/.pm2/logs/mandala-engine-out.log"
    }
  ]
};
