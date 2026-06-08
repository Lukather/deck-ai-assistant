#!/bin/bash
# Deploy script for AI-ssistant Deck plugin to Steam Deck
# Usage: ./deploy.sh [steamdeck-hostname]
# Default hostname: steamdeck.local

set -e  # Exit on error

# Configuration
REMOTE_HOST="${1:-deck@steamdeck.local}"
PLUGIN_DIR="/home/deck/homebrew/plugins/deck-ai-assistant"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying AI-ssistant Deck to Steam Deck${NC}"
echo -e "Target: ${YELLOW}$REMOTE_HOST${NC}"
echo ""

# Step 1: Build
echo -e "${GREEN}📦 Building plugin...${NC}"
pnpm build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 2: Check voice dependencies
echo -e "${GREEN}📁 Checking voice dependencies...${NC}"
VOICE_DEPS=("nerd-dictation" "vosk" "vosk-model")
for dep in "${VOICE_DEPS[@]}"; do
    if [ -d "$dep" ]; then
        echo -e "  ✅ $dep exists"
    else
        echo -e "  ⚠️  $dep not found (voice features may not work)"
    fi
done
echo ""

# Step 3: Create remote directory (only if needed)
echo -e "${GREEN}📂 Ensuring remote directory exists...${NC}"
ssh "$REMOTE_HOST" "mkdir -p $PLUGIN_DIR && sudo chown deck:deck $PLUGIN_DIR" 2>/dev/null || \
ssh "$REMOTE_HOST" "mkdir -p $PLUGIN_DIR"
echo ""

# Step 4: Sync files
echo -e "${GREEN}📤 Syncing plugin files...${NC}"
scp -r dist/* main.py plugin.json "$REMOTE_HOST:$PLUGIN_DIR/"
echo ""

# Step 5: Sync voice dependencies if they exist
for dep in "${VOICE_DEPS[@]}"; do
    if [ -d "$dep" ]; then
        echo -e "${GREEN}📤 Syncing $dep...${NC}"
        scp -r "$dep" "$REMOTE_HOST:$PLUGIN_DIR/"
    fi
done
echo ""

# Step 6: Restart Decky
echo -e "${GREEN}🔄 Restarting Decky Loader...${NC}"
ssh "$REMOTE_HOST" "sudo systemctl restart decky-loader" 2>/dev/null || \
ssh "$REMOTE_HOST" "systemctl --user restart decky-loader" 2>/dev/null || \
echo -e "${YELLOW}⚠️  Could not auto-restart Decky. Please restart manually.${NC}"
echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}Open Steam Deck and press ⚙️ to access the plugin${NC}"
