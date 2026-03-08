# JadisatuOS - Deployment Guide

## VPS Details

| Item | Value |
|------|-------|
| OS | Ubuntu 25.10 |
| IP | 76.13.190.196 |
| SSH Port | 2222 |
| User | root |
| Node.js | v22.22.0 |
| npm | 10.9.4 |
| Python | 3.13 |
| PM2 | 6.x |

## Directory Layout on VPS

```
/root/jadisatu.cloud/               # Git repo (pulled by CI/CD)
  ├── nextjs-app/                    # Next.js app source
  ├── hunter-agent/backend/          # Python API source
  ├── frontend/                      # Static frontend source
  ├── deploy/deploy.sh               # Deployment script
  └── ecosystem.config.js            # PM2 process config

/var/www/jadisatu.cloud/public/      # Nginx static frontend root (synced from frontend/)
/var/log/jadisatu-deploy.log         # Deployment history log
```

## Process Management (PM2)

| Process | Port | Command |
|---------|------|---------|
| jadisatu-nextjs | 3000 | `next start -p 3000` |
| hunter-agent | 8000 | `uvicorn api:app --host 0.0.0.0 --port 8000` |

### PM2 Commands
```bash
pm2 status                      # List all processes
pm2 logs jadisatu-nextjs        # View Next.js logs
pm2 logs hunter-agent           # View API logs
pm2 reload all                  # Graceful reload
pm2 restart jadisatu-nextjs     # Hard restart
pm2 monit                       # Real-time monitoring
```

## Nginx Configuration

- `/` → serves static frontend from `/var/www/jadisatu.cloud/public/`
- `/api/` → proxy to `localhost:8000` (hunter-agent FastAPI)
- Port 80 (HTTP) and 443 (HTTPS with self-signed cert)

## Deployment Flow

```
Developer / AI pushes to main
         │
         ▼
GitHub Actions (.github/workflows/deploy.yml)
         │
         ▼
SSH into VPS (key auth, port 2222)
         │
         ▼
Run deploy/deploy.sh
         │
         ├── git pull (ff-only)
         ├── npm ci + npm run build (Next.js)
         ├── rsync frontend → nginx root
         ├── pip install (Python deps)
         ├── pm2 reload
         ├── nginx reload
         ├── health checks
         └── log result to /var/log/jadisatu-deploy.log
```

## Manual Deployment

```bash
ssh -p 2222 root@76.13.190.196
cd /root/jadisatu.cloud
bash deploy/deploy.sh
```

## Rollback

```bash
ssh -p 2222 root@76.13.190.196
cd /root/jadisatu.cloud
git log --oneline -10              # Find commit to rollback to
git checkout <commit-hash>
bash deploy/deploy.sh
git checkout main                  # Return to main after testing
```

## Monitoring

```bash
# Deployment history
tail -50 /var/log/jadisatu-deploy.log

# Process health
pm2 status

# Live logs
pm2 logs --lines 50

# Quick health check
bash deploy/check-status.sh
```

## GitHub Secrets (configured)

| Secret | Description |
|--------|------------|
| VPS_HOST | VPS IP address |
| VPS_USER | SSH username |
| VPS_PORT | SSH port |
| VPS_SSH_KEY | Ed25519 private key for SSH auth |

## Troubleshooting

### Deploy failed: "Fast-forward merge failed"
Someone modified files directly on VPS. Fix:
```bash
cd /root/jadisatu.cloud
git stash          # Save local changes
git pull origin main
git stash pop      # Reapply if needed
```

### Next.js not responding
```bash
pm2 logs jadisatu-nextjs --lines 30
pm2 restart jadisatu-nextjs
```

### Hunter Agent not responding
```bash
pm2 logs hunter-agent --lines 30
pm2 restart hunter-agent
```
