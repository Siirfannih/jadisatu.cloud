#\!/usr/bin/env bash
#
# check-status.sh - Quick health check for JadisatuOS
#

echo "=== JadisatuOS Status ==="
echo ""

# Last deployment
echo "--- Last Deploy ---"
grep "DEPLOY SUCCESS\|DEPLOY FAILED" /var/log/jadisatu-deploy.log 2>/dev/null | tail -1 || echo "No deploy history"
echo ""

# PM2 processes
echo "--- PM2 Processes ---"
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    for p in procs:
        name = p.get(\"name\", \"unknown\")
        status = p.get(\"pm2_env\", {}).get(\"status\", \"unknown\")
        pid = p.get(\"pid\", \"?\")
        mem = round(p.get(\"monit\", {}).get(\"memory\", 0) / 1024 / 1024, 1)
        cpu = p.get(\"monit\", {}).get(\"cpu\", 0)
        print(f\"  {name}: {status} (pid={pid}, mem={mem}MB, cpu={cpu}%)\")
except:
    print(\"  Could not parse PM2 data\")
" 2>/dev/null || pm2 status
echo ""

# Health checks
echo "--- Health Checks ---"
curl -sf http://localhost:3000 > /dev/null 2>&1 && echo "  Next.js (3000): OK" || echo "  Next.js (3000): FAIL"
curl -sf http://localhost:8000/docs > /dev/null 2>&1 && echo "  Hunter API (8000): OK" || echo "  Hunter API (8000): FAIL"
curl -sf http://localhost:80 > /dev/null 2>&1 && echo "  Nginx (80): OK" || echo "  Nginx (80): FAIL"
echo ""

# Git status
echo "--- Git ---"
cd /root/jadisatu.cloud
echo "  Branch: $(git branch --show-current)"
echo "  Commit: $(git log -1 --pretty=\"%h %s\" 2>/dev/null)"
echo "  Status: $(git status --short | wc -l) uncommitted changes"
