#!/bin/bash
# Build script for macOS (Apple Silicon M4)
set -e

echo "🔨 Building Claude Proxy Manager for macOS..."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    echo "✓ Apple Silicon (M1/M2/M3/M4) detected"
    TARGET_ARCH="arm64"
else
    echo "✓ Intel Mac detected"
    TARGET_ARCH="x64"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Install with: brew install node"
    exit 1
fi

echo "✓ Node.js $(node -v) found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create build directory if it doesn't exist
mkdir -p build

# Create placeholder icon if it doesn't exist
if [ ! -f build/icon.icns ]; then
    echo "⚠️  Warning: build/icon.icns not found"
    echo "   The app will use default Electron icon"
    echo "   To add custom icon: create build/icon.icns (1024x1024 PNG converted to ICNS)"
fi

# Build the app
echo ""
echo "🚀 Building application..."
npm run build:mac

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Output files:"
ls -lh dist/*.dmg 2>/dev/null || echo "   No .dmg files found"
echo ""
echo "🎯 To install:"
echo "   1. Open the .dmg file in dist/"
echo "   2. Drag 'Claude Proxy Manager' to Applications"
echo "   3. Launch from Applications or use launch-mac.sh"
echo ""
