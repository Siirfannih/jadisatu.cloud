# Visual Engine proxy — add to /etc/nginx/sites-available/jadisatu.cloud
# Place this BEFORE the general /api/ location block
#
# location /api/visual/ {
#     proxy_pass http://127.0.0.1:8100;
#     proxy_http_version 1.1;
#     proxy_set_header Host $host;
#     proxy_set_header X-Real-IP $remote_addr;
#     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     proxy_set_header X-Forwarded-Proto $scheme;
#     proxy_read_timeout 120s;
#     proxy_send_timeout 120s;
#     client_max_body_size 20M;
# }
#
# To install automatically, run:
#   bash deploy/setup-nginx-visual-engine.sh

#!/usr/bin/env bash
set -euo pipefail

NGINX_CONF="/etc/nginx/sites-available/jadisatu.cloud"
NGINX_ENABLED="/etc/nginx/sites-enabled/jadisatu.cloud"

# Check if already configured
if grep -q "api/visual" "$NGINX_CONF" 2>/dev/null; then
    # Ensure sites-enabled is in sync
    cp "$NGINX_CONF" "$NGINX_ENABLED"
    echo "[nginx] Visual Engine proxy already configured"
    exit 0
fi

# Find the line with "location /api/" and insert visual engine proxy BEFORE it
if grep -q "location /api/" "$NGINX_CONF"; then
    sed -i '/location \/api\//i \
    # Visual Engine API (port 8100)\
    location /api/visual/ {\
        proxy_pass http://127.0.0.1:8100;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 120s;\
        proxy_send_timeout 120s;\
        client_max_body_size 20M;\
    }\
' "$NGINX_CONF"
    echo "[nginx] Visual Engine proxy added before /api/ block"
else
    echo "[nginx] WARNING: Could not find 'location /api/' block in $NGINX_CONF"
    echo "[nginx] Please manually add the visual engine proxy block"
    exit 1
fi

# Sync sites-enabled
cp "$NGINX_CONF" "$NGINX_ENABLED"

# Test and reload
nginx -t && nginx -s reload
echo "[nginx] Config tested and reloaded"
