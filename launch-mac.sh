#!/bin/bash
# Claude Proxy Manager Launcher for macOS
# Supports Apple Silicon (M1/M2/M3/M4) and Intel

set -e

APP_NAME="Claude Proxy Manager"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting $APP_NAME..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   brew install node"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current: $(node -v)"
    echo "   Please update Node.js:"
    echo "   brew upgrade node"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check if .claude directory exists
CLAUDE_DIR="$HOME/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
    echo "❌ Claude Code directory not found at $CLAUDE_DIR"
    echo "   Please install Claude Code first"
    exit 1
fi

echo "✓ Claude Code directory found"

# Check if proxy-server.mjs exists
PROXY_FILE="$CLAUDE_DIR/proxy-server.mjs"
if [ ! -f "$PROXY_FILE" ]; then
    echo "❌ Proxy server file not found at $PROXY_FILE"
    echo "   Please ensure Claude Code proxy is configured"
    exit 1
fi

echo "✓ Proxy server file found"

# Check if .env exists
ENV_FILE="$CLAUDE_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Warning: .env file not found at $ENV_FILE"
    echo "   Some features may not work without API keys"
else
    echo "✓ Environment file found"
fi

# Check if Electron app is built
if [ -d "$APP_DIR/dist" ]; then
    echo "✓ Launching built application..."
    open "$APP_DIR/dist/mac-arm64/Claude Proxy Manager.app" 2>/dev/null || \
    open "$APP_DIR/dist/mac/Claude Proxy Manager.app" 2>/dev/null || \
    echo "❌ Built application not found. Please run: npm run build:mac"
else
    echo "⚠️  Built application not found. Starting in development mode..."
    echo "   To build: npm run build:mac"
    echo ""
    
    # Check if node_modules exists
    if [ ! -d "$APP_DIR/node_modules" ]; then
        echo "📦 Installing dependencies..."
        cd "$APP_DIR" && npm install
    fi
    
    # Start in development mode
    cd "$APP_DIR" && npm start
fi

echo "✓ $APP_NAME started successfully"
