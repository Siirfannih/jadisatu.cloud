module.exports = {
  apps: [
    {
      name: "jadisatu-nextjs",
      cwd: "./nextjs-app",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/root/.pm2/logs/jadisatu-nextjs-error.log",
      out_file: "/root/.pm2/logs/jadisatu-nextjs-out.log"
    },
    {
      name: "hunter-agent",
      cwd: "./hunter-agent/backend",
      script: "uvicorn",
      args: "api:app --host 0.0.0.0 --port 8000",
      interpreter: "/usr/bin/python3",
      env: {
        PORT: 8000
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/root/.pm2/logs/hunter-agent-error.log",
      out_file: "/root/.pm2/logs/hunter-agent-out.log"
    }
  ]
};
