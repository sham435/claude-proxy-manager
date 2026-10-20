const { app, BrowserWindow, ipcMain, dialog, shell, protocol, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

let Store;
try { Store = require('electron-store'); } catch (_) { Store = null; }

const store = Store ? new Store({ name: 'claude-proxy-settings' }) : null;
let mainWindow;
let proxyProcess = null;
let proxyMonitorInterval = null;

const isDev = process.argv.includes('--dev');

// ─── Reliable HOME detection (launchd-safe) ───
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || os.homedir();
const CLAUDE_DIR = path.join(HOME_DIR, '.claude');
const PROXY_PATH = path.join(CLAUDE_DIR, 'proxy-server.mjs');
const PROXY_LOG = path.join(CLAUDE_DIR, 'proxy.log');
const PROXY_URL = 'http://127.0.0.1:8082';
const CONFIG_PATH = path.join(CLAUDE_DIR, 'agentic', 'config.mjs');

// ─── Node.js binary detection (PATH may not include homebrew/nvm in Finder-launched apps) ───
function findNodeBinary() {
  const candidates = [
    // Homebrew Apple Silicon
    '/opt/homebrew/bin/node',
    // Homebrew Intel
    '/usr/local/bin/node',
    // nvm (try current)
    path.join(HOME_DIR, '.nvm', 'versions', 'node', 'current', 'bin', 'node'),
    // asdf
    path.join(HOME_DIR, '.asdf', 'shims', 'node'),
    // Volta
    path.join(HOME_DIR, '.volta', 'bin', 'node'),
    // fnm
    path.join(HOME_DIR, '.fnm', 'node-versions', 'installation', 'bin', 'node'),
    // System
    '/usr/bin/node',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Try resolving via which (works if PATH has it)
  try {
    const found = execSync('which node', { encoding: 'utf8', env: { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' } }).trim();
    if (found && fs.existsSync(found)) return found;
  } catch (_) {}
  // Fallback — hope spawn finds it
  return 'node';
}

// ─── Register custom scheme before app ready ───
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// ─── Single instance lock ───
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ─── Window creation ───
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    title: 'Claude Proxy Manager',
    backgroundColor: '#f9fafb',
  });

  mainWindow.loadURL('app://bundle/index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // Block navigation away from app://
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) e.preventDefault();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ─── Build application menu ───
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'About Claude Proxy Manager' },
        { type: 'separator' },
        { label: 'Start Proxy', accelerator: 'Cmd+Shift+S', click: () => mainWindow?.webContents.send('menu-action', 'start') },
        { label: 'Stop Proxy', accelerator: 'Cmd+Shift+X', click: () => mainWindow?.webContents.send('menu-action', 'stop') },
        { label: 'View Logs', accelerator: 'Cmd+Shift+L', click: () => mainWindow?.webContents.send('menu-action', 'logs') },
        { label: 'Refresh Status', accelerator: 'Cmd+Shift+R', click: () => mainWindow?.webContents.send('menu-action', 'refresh') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Claude Code Docs', click: () => shell.openExternal('https://docs.anthropic.com/en/docs/claude-code') },
        { label: 'Proxy Architecture', click: () => shell.openExternal('https://github.com/sham435/claude-proxy-manager') },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'Alt+Cmd+I', click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Helper: HTTP health check ───
function isProxyHealthy() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`${PROXY_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(res.statusCode === 200 ? data : null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
  });
}

// ─── Helper: Parse models from config.mjs ───
function readModelChain() {
  try {
    const src = fs.readFileSync(CONFIG_PATH, 'utf8');
    // Extract TEXT_PRIORITY_CHAIN and TOOL_PRIORITY_CHAIN arrays
    const textMatch = src.match(/TEXT_PRIORITY_CHAIN\s*=\s*\[([\s\S]*?)\]/);
    const toolMatch = src.match(/TOOL_PRIORITY_CHAIN\s*=\s*\[([\s\S]*?)\]/);
    // Extract provider maps
    const zenMatch = src.match(/ZEN_MODELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
    const nvidiaMatch = src.match(/NVIDIA_MODELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
    const ollamaMatch = src.match(/OLLAMA_MODELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
    const openrouterMatch = src.match(/OPENROUTER_MODELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
    const agentrouterMatch = src.match(/AGENTROUTER_MODELS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);

    const parseList = (m) => m ? m[1].match(/'[^']+'/g)?.map(s => s.replace(/'/g, '')) || [] : [];

    const zenModels = new Set(parseList(zenMatch));
    const nvidiaModels = new Set(parseList(nvidiaMatch));
    const ollamaModels = new Set(parseList(ollamaMatch));
    const openrouterModels = new Set(parseList(openrouterMatch));
    const agentrouterModels = new Set(parseList(agentrouterMatch));

    const textChain = parseList(textMatch);

    const getProvider = (name) => {
      if (ollamaModels.has(name)) return 'Ollama';
      if (zenModels.has(name)) return 'OpenCode Zen';
      if (nvidiaModels.has(name)) return 'NVIDIA NIM';
      if (openrouterModels.has(name)) return 'OpenRouter';
      if (agentrouterModels.has(name)) return 'AgentRouter';
      return 'Unknown';
    };

    const getType = (provider) => {
      if (provider === 'Ollama') return 'Local';
      return 'Free';
    };

    return {
      textChain,
      toolChain: parseList(toolMatch),
      models: textChain.map(name => ({
        name,
        provider: getProvider(name),
        type: getType(getProvider(name)),
      })),
    };
  } catch (_) {
    return { textChain: [], toolChain: [], models: [] };
  }
}

// ─── Read tail of log file efficiently ───
function readLogTail(filePath, maxLines) {
  try {
    const stat = fs.statSync(filePath);
    // For files under 500KB, just read it all
    if (stat.size < 500_000) {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').slice(-maxLines).join('\n');
    }
    // For large files, read last chunk
    const readSize = Math.min(stat.size, maxLines * 200);
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    return buffer.toString('utf8').split('\n').slice(-maxLines).join('\n');
  } catch (_) {
    return '';
  }
}

// ─── IPC Handlers ───

ipcMain.handle('start-proxy', async () => {
  if (proxyProcess && !proxyProcess.killed) {
    return { success: true, message: 'Proxy already running (managed by app)', pid: proxyProcess.pid };
  }

  const healthData = await isProxyHealthy();
  if (healthData) {
    return { success: true, message: 'Proxy already running on port 8082', health: JSON.parse(healthData) };
  }

  if (!fs.existsSync(PROXY_PATH)) {
    throw new Error(`Proxy file not found: ${PROXY_PATH}`);
  }

  const nodeBin = findNodeBinary();
  const envPath = path.join(CLAUDE_DIR, '.env');
  let envVars = {};
  if (fs.existsSync(envPath)) {
    try {
      fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [key, ...parts] = line.split('=');
          envVars[key.trim()] = parts.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
      });
    } catch (_) {}
  }

  const env = { ...process.env, ...envVars };
  // Ensure HOME is set
  env.HOME = HOME_DIR;
  env.USERPROFILE = HOME_DIR;

  proxyProcess = spawn(nodeBin, [PROXY_PATH], {
    cwd: CLAUDE_DIR,
    env,
    detached: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const logStream = fs.createWriteStream(PROXY_LOG, { flags: 'a' });
  proxyProcess.stdout?.pipe(logStream);
  proxyProcess.stderr?.pipe(logStream);

  proxyProcess.on('error', (err) => {
    proxyProcess = null;
  });

  let exitCode = null;
  proxyProcess.on('exit', (code) => {
    exitCode = code;
    proxyProcess = null;
    notifyStatusChange(false);
  });

  await new Promise(r => setTimeout(r, 2500));

  if (exitCode !== null) {
    const nowHealthy = await isProxyHealthy();
    if (nowHealthy) {
      return { success: true, message: 'Proxy already running (port occupied, health confirmed)' };
    }
    const lastLog = readLogTail(PROXY_LOG, 5);
    throw new Error(`Proxy exited (code ${exitCode}): ${lastLog}`);
  }

  if (proxyProcess && !proxyProcess.killed) {
    notifyStatusChange(true);
    return { success: true, message: 'Proxy started successfully', pid: proxyProcess.pid };
  }

  throw new Error('Proxy failed to start (unknown state)');
});

ipcMain.handle('stop-proxy', async () => {
  if (proxyProcess) {
    proxyProcess.kill('SIGTERM');
    proxyProcess = null;
    notifyStatusChange(false);
    return { success: true, message: 'Proxy stopped (managed process killed)' };
  }
  const cmd = process.platform === 'win32'
    ? 'taskkill /F /FI "WINDOWTITLE eq proxy-server*"'
    : 'pkill -f proxy-server.mjs';
  try { execSync(cmd, { stdio: 'ignore', timeout: 3000 }); } catch (_) {}
  notifyStatusChange(false);
  return { success: true, message: 'Proxy stop signal sent' };
});

ipcMain.handle('get-proxy-status', async () => {
  const data = await isProxyHealthy();
  if (data) {
    try {
      return { running: true, health: JSON.parse(data), pid: proxyProcess?.pid || null };
    } catch (_) {
      return { running: true, health: {}, pid: proxyProcess?.pid || null };
    }
  }
  return { running: false, health: {}, pid: null };
});

ipcMain.handle('get-models', async () => {
  return readModelChain();
});

ipcMain.handle('get-logs', async (_event, lines = 100) => {
  return readLogTail(PROXY_LOG, lines) || 'No logs available.';
});

ipcMain.handle('open-log-file', async () => {
  if (fs.existsSync(PROXY_LOG)) {
    shell.openPath(PROXY_LOG);
    return { success: true };
  }
  throw new Error('Log file not found: ' + PROXY_LOG);
});

ipcMain.handle('open-config-dir', async () => {
  if (fs.existsSync(CLAUDE_DIR)) {
    shell.openPath(CLAUDE_DIR);
    return { success: true };
  }
  throw new Error('Config directory not found: ' + CLAUDE_DIR);
});

ipcMain.handle('save-config', async (_event, config) => {
  if (!store) throw new Error('electron-store not available');
  store.set('config', config);
  return { success: true };
});

ipcMain.handle('load-config', async () => {
  return store ? store.get('config', {}) : {};
});

ipcMain.handle('export-config', async (_event, config) => {
  if (!mainWindow) throw new Error('Window not available');
  const { response, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Configuration',
    defaultPath: `claude-proxy-config-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (response === 0 && filePath) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true, path: filePath };
  }
  return { success: false, cancelled: true };
});

ipcMain.handle('show-message', async (_event, options) => {
  if (!mainWindow) return { response: 0 };
  return dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('get-env-info', async () => {
  const nodeBin = findNodeBinary();
  const proxyExists = fs.existsSync(PROXY_PATH);
  const configExists = fs.existsSync(CONFIG_PATH);
  const envExists = fs.existsSync(path.join(CLAUDE_DIR, '.env'));
  const logExists = fs.existsSync(PROXY_LOG);

  let nodeVersion = 'unknown';
  try { nodeVersion = execSync(`${nodeBin} --version`, { encoding: 'utf8', timeout: 3000 }).trim(); } catch (_) {}

  let claudeVersion = 'not found';
  try { claudeVersion = execSync('claude --version 2>/dev/null || echo "not found"', { encoding: 'utf8', timeout: 5000, env: process.env }).trim(); } catch (_) {}

  return {
    homeDir: HOME_DIR,
    claudeDir: CLAUDE_DIR,
    proxyPath: PROXY_PATH,
    proxyExists,
    configExists,
    envExists,
    logExists,
    nodeBin,
    nodeVersion,
    claudeVersion,
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
  };
});

// ─── Generic HTTP proxy request (bypasses renderer CORS) ───
ipcMain.handle('proxy-request', async (_event, opts) => {
  const http = require('http');
  const { method = 'GET', path: reqPath = '/health', body, headers = {} } = opts;

  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, PROXY_URL);
    const postData = body ? JSON.stringify(body) : null;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'claude-proxy-manager',
        'anthropic-version': '2023-06-01',
        ...headers,
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Proxy unreachable: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy request timed out (30s)')); });
    if (postData) req.write(postData);
    req.end();
  });
});

// ─── Push status changes to renderer ───
function notifyStatusChange(running) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('proxy-status-changed', { running });
  }
}

// ─── App lifecycle ───
app.whenReady().then(() => {
  // Register protocol
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath = url.pathname;
    if (filePath === '/' || filePath === '//') filePath = '/index.html';
    const fullPath = path.join(__dirname, 'src', filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimes = {
      '.html': 'text/html', '.js': 'application/javascript', '.jsx': 'text/plain',
      '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
    };
    try {
      const data = fs.readFileSync(fullPath);
      return new Response(data, { status: 200, headers: { 'Content-Type': mimes[ext] || 'application/octet-stream' } });
    } catch (_) {
      return new Response('Not Found', { status: 404 });
    }
  });

  buildMenu();
  createWindow();

  // Monitor external proxy process (detect if killed externally)
  proxyMonitorInterval = setInterval(async () => {
    if (proxyProcess) return; // We manage it, exit handler will fire
    // Check if external proxy went down
    const healthy = await isProxyHealthy();
    notifyStatusChange(!!healthy);
  }, 10000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function cleanup() {
  if (proxyMonitorInterval) clearInterval(proxyMonitorInterval);
  if (proxyProcess) {
    try { proxyProcess.kill('SIGTERM'); } catch (_) {}
    proxyProcess = null;
  }
}

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { cleanup(); });
app.on('will-quit', () => { cleanup(); });

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
