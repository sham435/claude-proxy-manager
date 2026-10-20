# Claude Proxy Manager

Professional desktop application for managing your Claude Code proxy server with real-time monitoring, health tracking, and multi-platform support.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🚀 **One-Click Proxy Management** - Start/stop proxy server with single click
- 📊 **Real-Time Monitoring** - Live health status, latency metrics, and request tracking
- 🤖 **Multi-Model Support** - Manage 12+ models across 5 providers
- 🔀 **Automatic Failover** - Intelligent model switching with health tracking
- ⚡ **Local Ollama Integration** - Seamless fallback to local models
- 📝 **Detailed Logging** - Comprehensive audit trail with JSON export
- 🎨 **Professional UI** - Clean, corporate design with React + Tailwind CSS

## Platform Support

- **macOS** - Apple Silicon (M1/M2/M3/M4) and Intel
- **Windows** - 64-bit (Windows 10/11)

## Quick Start

### Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Claude Code** - Installed and configured at `~/.claude`
3. **Proxy Server** - `proxy-server.mjs` in `~/.claude/`

### Installation

#### macOS (Apple Silicon M4)

```bash
# Clone or download this repository
cd claude-proxy-app

# Make scripts executable
chmod +x launch-mac.sh build-mac.sh

# Install dependencies
npm install

# Build .dmg installer
./build-mac.sh

# Install the app
open dist/*.dmg
# Drag "Claude Proxy Manager" to Applications
```

#### Windows 10/11 64-bit

```batch
REM Clone or download this repository
cd claude-proxy-app

REM Install dependencies
npm install

REM Build .exe installer
build-windows.bat

REM Run the installer
dist\"Claude Proxy Manager Setup *.exe"
```

### Development Mode

If you want to run without building:

**macOS:**
```bash
./launch-mac.sh
```

**Windows:**
```batch
launch-windows.bat
```

## Usage

### Starting the App

**macOS:**
- Launch from Applications folder
- Or run: `./launch-mac.sh`

**Windows:**
- Launch from Start Menu → Claude Proxy Manager
- Or run: `launch-windows.bat`

### Quick Actions

The dashboard provides 6 quick action buttons:

1. **▶ Start Proxy** - Start the proxy server
2. **⏸ Stop Proxy** - Stop the proxy server
3. **🔄 Reset Health** - Reset all health scores
4. **📋 View Logs** - View proxy logs
5. **🧪 Test Model** - Test selected model
6. **💾 Export Config** - Export configuration as JSON

### Monitoring

The dashboard displays:

- **Proxy Status** - Running/Stopped indicator with live updates
- **Stats Overview** - Total requests, success rate, avg latency, active models
- **Model Table** - All available models with provider, type, status, and latency
- **Recent Activity** - Live feed of proxy events
- **Configuration** - Current settings and file locations

### Keyboard Shortcuts

- `Ctrl+Shift+S` - Start proxy
- `Ctrl+Shift+X` - Stop proxy
- `Ctrl+Shift+R` - Reset health
- `Ctrl+Shift+L` - View logs
- `Ctrl+Shift+T` - Test model
- `Ctrl+Shift+E` - Export config

## Building from Source

### macOS Build

```bash
# Install dependencies
npm install

# Build for Apple Silicon
npm run build:mac

# Output: dist/Claude Proxy Manager-1.0.0-arm64.dmg
```

### Windows Build

```batch
REM Install dependencies
npm install

REM Build for Windows 64-bit
npm run build:win

REM Output: dist/Claude Proxy Manager Setup 1.0.0.exe
```

### Build All Platforms

```bash
npm run build:all
```

## Configuration

### Proxy Settings

The app automatically detects your Claude Code configuration:

- **Proxy Path**: `~/.claude/proxy-server.mjs`
- **Environment**: `~/.claude/.env`
- **Logs**: `~/.claude/proxy.log`
- **Settings**: `~/.claude/settings.json`

### Custom Configuration

You can export and import configurations:

1. Click **💾 Export Config** to save current settings
2. Share the JSON file with team members
3. Import on other machines

## Troubleshooting

### Proxy Won't Start

**macOS:**
```bash
# Check if port 8082 is in use
lsof -ti:8082

# Kill existing process
pkill -f proxy-server.mjs

# Check logs
tail -50 ~/.claude/proxy.log
```

**Windows:**
```batch
REM Check if port 8082 is in use
netstat -ano | findstr :8082

REM Kill existing process
taskkill /F /IM node.exe /FI "WINDOWTITLE eq proxy-server*"

REM Check logs
type %USERPROFILE%\.claude\proxy.log
```

### Node.js Version Error

Update Node.js to version 18 or higher:

**macOS:**
```bash
brew upgrade node
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/)

### Build Fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Electron cache
npm cache clean --force

# Try building again
npm run build
```

## File Structure

```
claude-proxy-app/
├── main.js                 # Electron main process
├── preload.js              # Secure IPC bridge
├── package.json            # Dependencies and build config
├── src/
│   ├── index.html          # HTML entry point
│   └── dashboard.jsx       # React dashboard component
├── build/                  # Build resources (icons, etc.)
├── dist/                   # Built applications
├── launch-mac.sh           # macOS launcher
├── launch-windows.bat      # Windows launcher
├── build-mac.sh            # macOS build script
├── build-windows.bat       # Windows build script
└── README.md               # This file
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This opens the app with DevTools for debugging.

### Adding Custom Icons

**macOS:**
```bash
# Convert PNG to ICNS
convert icon.png -define icon:auto-resize=1024,512,256,128,64,32,16 build/icon.icns
```

**Windows:**
```bash
# Convert PNG to ICO
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

### Customizing the Dashboard

Edit `src/dashboard.jsx` to customize:

- Colors and styling
- Model list
- Feature descriptions
- Quick actions

Then rebuild:
```bash
npm run build
```

## API Integration

The app communicates with your proxy server via:

- `GET /health` - Health check
- `POST /agent/reset-health` - Reset health scores
- `POST /v1/messages` - Test model requests

All API calls are made to `http://127.0.0.1:8082`

## Security

- **Context Isolation** - Renderer process is isolated from Node.js
- **Content Security Policy** - Strict CSP headers
- **Secure IPC** - All communication through preload bridge
- **No Remote Code** - All code is local

## License

MIT License - See LICENSE file for details

## Support

- **Documentation**: See `claude-proxy-guide.md`
- **Issues**: Check `~/.claude/proxy.log`
- **Community**: [Claude Code Forum](https://forum.qoder.com/)

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [electron-builder](https://www.electron.build/)

---

**Made with ❤️ for the Claude Code community**
