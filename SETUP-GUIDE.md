# Claude Proxy Manager - Setup Guide

Complete guide for building and deploying the Claude Proxy Manager on macOS (Apple Silicon M4) and Windows 10/11 64-bit.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [macOS Setup (Apple Silicon M4)](#macos-setup)
4. [Windows Setup (64-bit)](#windows-setup)
5. [Building Installers](#building-installers)
6. [Distribution](#distribution)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Claude Proxy Manager is a desktop application built with Electron, React, and Tailwind CSS. It provides a professional interface for managing your Claude Code proxy server.

**Components:**
- React Dashboard - Professional UI with real-time monitoring
- Electron Wrapper - Desktop app with native features
- Launcher Scripts - Easy startup for both platforms
- Build Scripts - Automated .dmg and .exe creation

---

## Prerequisites

### Required for Both Platforms

1. **Node.js 18 or higher**
   - macOS: `brew install node`
   - Windows: Download from https://nodejs.org/

2. **Git** (optional, for version control)
   - macOS: `brew install git`
   - Windows: Download from https://git-scm.com/

3. **Claude Code** installed and configured
   - Proxy server at `~/.claude/proxy-server.mjs`
   - Environment file at `~/.claude/.env`

### macOS Specific

- **macOS 12+** (Monterey or later)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Apple Silicon (M1/M2/M3/M4)** or Intel Mac

### Windows Specific

- **Windows 10/11 64-bit**
- **PowerShell 5.1+** (included with Windows)
- **Administrator rights** (for installation)

---

## macOS Setup

### Step 1: Prepare the Project

```bash
# Navigate to the app directory
cd /path/to/claude-proxy-app

# Make scripts executable
chmod +x launch-mac.sh build-mac.sh

# Verify permissions
ls -la *.sh
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Electron (desktop framework)
- electron-builder (packaging tool)
- electron-store (configuration storage)

### Step 3: Test in Development Mode

```bash
./launch-mac.sh
```

Or manually:
```bash
npm start
```

The app should open and display the dashboard.

### Step 4: Add Custom Icon (Optional)

Create a 1024x1024 PNG icon and convert to ICNS:

```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=1024,512,256,128,64,32,16 build/icon.icns

# Or use online converter: https://cloudconvert.com/png-to-icns
```

Place the icon at: `build/icon.icns`

---

## Windows Setup

### Step 1: Prepare the Project

Open Command Prompt or PowerShell:

```batch
REM Navigate to the app directory
cd C:\path\to\claude-proxy-app
```

### Step 2: Install Dependencies

```batch
npm install
```

### Step 3: Test in Development Mode

```batch
launch-windows.bat
```

Or manually:
```batch
npm start
```

### Step 4: Add Custom Icon (Optional)

Create a 256x256 PNG icon and convert to ICO:

```batch
REM Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build\icon.ico

REM Or use online converter: https://cloudconvert.com/png-to-ico
```

Place the icon at: `build\icon.ico`

---

## Building Installers

### macOS .dmg Installer (Apple Silicon)

```bash
./build-mac.sh
```

Or manually:
```bash
npm run build:mac
```

**Output:** `dist/Claude Proxy Manager-1.0.0-arm64.dmg`

**What it does:**
1. Checks for Node.js and architecture
2. Installs dependencies
3. Builds Electron app for arm64
4. Creates .dmg installer
5. Shows installation instructions

### Windows .exe Installer (64-bit)

```batch
build-windows.bat
```

Or manually:
```batch
npm run build:win
```

**Output:** `dist/Claude Proxy Manager Setup 1.0.0.exe`

**What it does:**
1. Checks for Node.js and architecture
2. Installs dependencies
3. Builds Electron app for x64
4. Creates NSIS installer
5. Shows installation instructions

### Build All Platforms

From macOS:
```bash
npm run build:all
```

This creates both .dmg and .exe installers.

---

## Distribution

### macOS Distribution

#### Option 1: Direct .dmg File

1. Build the .dmg: `./build-mac.sh`
2. Share the file: `dist/Claude Proxy Manager-1.0.0-arm64.dmg`
3. Users double-click to open and drag to Applications

#### Option 2: Code Signing (Production)

For distribution outside your organization:

1. Get Apple Developer Certificate ($99/year)
2. Update `package.json`:
```json
"mac": {
  "identity": "Your Name (Team ID)",
  "hardenedRuntime": true,
  "entitlements": "build/entitlements.mac.plist"
}
```

3. Build with signing:
```bash
CSC_IDENTITY_AUTO_DISCOVERY=true npm run build:mac
```

#### Option 3: Notarization (Required for App Store)

```bash
# Install electron-notarize
npm install --save-dev electron-notarize

# Set environment variables
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export TEAM_ID=YOUR_TEAM_ID

# Build with notarization
npm run build:mac
```

### Windows Distribution

#### Option 1: Direct .exe File

1. Build the .exe: `build-windows.bat`
2. Share the file: `dist/Claude Proxy Manager Setup 1.0.0.exe`
3. Users run the installer

#### Option 2: Code Signing (Production)

1. Get code signing certificate ($200-400/year)
2. Import certificate:
```batch
certutil -importkey certificate.pfx
```

3. Update `package.json`:
```json
"win": {
  "certificateSubjectName": "Your Company Name",
  "certificateSha1": "YOUR_CERTIFICATE_THUMBPRINT"
}
```

4. Build with signing:
```batch
set CSC_LINK=path\to\certificate.pfx
set CSC_KEY_PASSWORD=your-password
npm run build:win
```

#### Option 3: Microsoft Store

Requires MSIX package format. See [Electron Builder documentation](https://www.electron.build/configuration/appx).

---

## Installation Guide for End Users

### macOS Installation

1. **Download** the .dmg file
2. **Double-click** to mount the disk image
3. **Drag** "Claude Proxy Manager" to Applications folder
4. **Eject** the disk image
5. **Launch** from Applications or Spotlight
6. **First launch**: Right-click → Open (to bypass Gatekeeper if needed)

### Windows Installation

1. **Download** the .exe installer
2. **Double-click** to run the installer
3. **Follow** the installation wizard
4. **Choose** installation directory (default: `C:\Program Files\Claude Proxy Manager`)
5. **Create** desktop shortcut (optional)
6. **Launch** from Start Menu or desktop shortcut

---

## Troubleshooting

### Build Errors

#### "Node.js version 18 or higher is required"

**Solution:** Update Node.js
```bash
# macOS
brew upgrade node

# Windows
# Download from https://nodejs.org/
```

#### "Cannot find module 'electron'"

**Solution:** Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

#### "Build failed: EACCES: permission denied"

**macOS:**
```bash
chmod +x build-mac.sh launch-mac.sh
```

**Windows:**
Run Command Prompt as Administrator

### Runtime Errors

#### "Proxy server file not found"

**Solution:** Ensure Claude Code is installed at `~/.claude`

#### "Port 8082 already in use"

**macOS:**
```bash
lsof -ti:8082 | xargs kill -9
```

**Windows:**
```batch
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8082') do taskkill /F /PID %a
```

#### "Cannot connect to proxy"

**Solution:** Start the proxy first
```bash
# macOS
cd ~/.claude && export $(grep -v '^#' .env | grep '=' | xargs) && nohup node proxy-server.mjs >> proxy.log 2>&1 &

# Windows
cd %USERPROFILE%\.claude
for /f "tokens=*" %i in ('type .env ^| findstr /v "^#" ^| findstr "="') do set %i
start /b node proxy-server.mjs
```

### Icon Issues

#### "Icon not found" warning

**Solution:** Create placeholder icon
```bash
# macOS
mkdir -p build
# Add icon.icns to build/

# Windows
mkdir build
# Add icon.ico to build\
```

#### "Icon looks pixelated"

**Solution:** Use higher resolution source image (1024x1024 for macOS, 256x256 for Windows)

---

## Advanced Configuration

### Custom App Name

Edit `package.json`:
```json
{
  "name": "your-custom-name",
  "build": {
    "productName": "Your Custom Name"
  }
}
```

### Custom App ID

Edit `package.json`:
```json
{
  "build": {
    "appId": "com.yourcompany.yourapp"
  }
}
```

### Additional Platforms

Add Linux support:
```json
{
  "build": {
    "linux": {
      "target": ["AppImage", "deb", "rpm"],
      "category": "Development"
    }
  }
}
```

Build:
```bash
npm run build:linux
```

---

## File Sizes

Expected output sizes:

- **macOS .dmg**: ~150-200 MB
- **Windows .exe**: ~100-150 MB
- **Source code**: ~5 MB (excluding node_modules)

---

## Performance

- **Startup time**: 2-3 seconds
- **Memory usage**: ~150-200 MB
- **CPU usage**: <1% when idle

---

## Support

For issues and questions:

1. Check `README.md` in the app directory
2. Review `claude-proxy-guide.md` for proxy configuration
3. Check proxy logs: `~/.claude/proxy.log`
4. Visit [Claude Code Forum](https://forum.qoder.com/)

---

## License

MIT License - Free for personal and commercial use

---

**Last Updated:** 2024
**Version:** 1.0.0
**Platforms:** macOS (Apple Silicon), Windows 64-bit
