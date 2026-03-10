#!/bin/bash
set -e

echo "=== Jadisatu.cloud Codespace Setup ==="

# Install dependencies for main Next.js app
echo ">>> Installing Next.js app dependencies..."
cd /workspaces/jadisatu.cloud/nextjs-app
npm install

# Create .env.local from Codespace secrets
echo ">>> Setting up environment variables..."
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF

# Clone companion repos for reference
echo ">>> Cloning companion repositories..."
cd /workspaces
if [ ! -d "Jadisatulight" ]; then
  git clone https://github.com/Siirfannih/Jadisatulight.git
fi
if [ ! -d "jadisatu-narrative-engine" ]; then
  git clone https://github.com/Siirfannih/jadisatu-narrative-engine.git
fi

# Install Claude Code CLI
echo ">>> Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. cd /workspaces/jadisatu.cloud/nextjs-app"
echo "  2. npm run dev        # Start dev server"
echo "  3. claude             # Start Claude Code agent"
echo ""
