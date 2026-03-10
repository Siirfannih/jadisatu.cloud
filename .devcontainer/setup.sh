#!/bin/bash
echo "=== Jadisatu.cloud Codespace Setup ==="

# Install Claude Code CLI first (highest priority)
echo ">>> Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code || echo "WARN: Claude Code install failed, install manually: npm install -g @anthropic-ai/claude-code"

# Verify Claude Code installed
if command -v claude &> /dev/null; then
  echo ">>> Claude Code installed successfully: $(claude --version)"
else
  echo ">>> WARN: Claude Code not found in PATH, trying again..."
  export PATH="$PATH:$(npm root -g)/.bin"
  npm install -g @anthropic-ai/claude-code
fi

# Install dependencies for main Next.js app
echo ">>> Installing Next.js app dependencies..."
cd /workspaces/jadisatu.cloud/nextjs-app
npm install

# Create .env.local from Codespace secrets
echo ">>> Setting up environment variables..."
cat > .env.local << ENVEOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENVEOF

echo ">>> .env.local created with all secrets"

# Make agent scripts executable
echo ">>> Setting up agent scripts..."
cd /workspaces/jadisatu.cloud
chmod +x agents/*.sh 2>/dev/null || true
chmod +x run-*.sh 2>/dev/null || true

# Clone companion repos for reference
echo ">>> Cloning companion repositories..."
cd /workspaces
if [ ! -d "Jadisatulight" ]; then
  git clone https://github.com/Siirfannih/Jadisatulight.git || echo "WARN: Failed to clone Jadisatulight"
fi
if [ ! -d "jadisatu-narrative-engine" ]; then
  git clone https://github.com/Siirfannih/jadisatu-narrative-engine.git || echo "WARN: Failed to clone narrative engine"
fi

# Verify setup
echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "  Secrets loaded:"
[ -n "${NEXT_PUBLIC_SUPABASE_URL}" ] && echo "    ✓ SUPABASE_URL" || echo "    ✗ SUPABASE_URL missing"
[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY}" ] && echo "    ✓ SUPABASE_ANON_KEY" || echo "    ✗ SUPABASE_ANON_KEY missing"
[ -n "${SUPABASE_SERVICE_KEY}" ] && echo "    ✓ SUPABASE_SERVICE_KEY" || echo "    ✗ SUPABASE_SERVICE_KEY missing"
[ -n "${GEMINI_API_KEY}" ] && echo "    ✓ GEMINI_API_KEY" || echo "    ✗ GEMINI_API_KEY missing (add at github.com/Siirfannih/jadisatu.cloud/settings/secrets/codespaces)"
echo ""
echo "  To run multi-agent phases:"
echo "    1. claude login"
echo "    2. cd /workspaces/jadisatu.cloud"
echo "    3. bash run-remaining-multiagent.sh"
echo ""
echo "  Or run single-agent phases:"
echo "    3. bash run-all-phases-10-13.sh"
echo ""
