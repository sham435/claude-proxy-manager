const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let proxyProcess = null;

const isDev = process.argv.includes('--dev');

// Register custom scheme BEFORE app is ready (privileged = fetch allowed)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// Proxy configuration
const PROXY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'proxy-server.mjs');
const PROXY_LOG = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'proxy.log');
const PROXY_URL = 'http://127.0.0.1:8082';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'default',
    title: 'Claude Proxy Manager',
    backgroundColor: '#f9fafb'
  });

  // Load via custom app:// protocol (serves src/ over HTTP — fixes XHR)
  mainWindow.loadURL('app://bundle/index.html');

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers

// Helper: check if proxy is already healthy
function isProxyHealthy() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`${PROXY_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// Start proxy server
ipcMain.handle('start-proxy', async () => {
  // Already managed by us?
  if (proxyProcess && !proxyProcess.killed) {
    return { success: true, message: 'Proxy already running (managed by app)', pid: proxyProcess.pid };
  }

  // Already running externally (e.g. started via terminal)?
  const healthy = await isProxyHealthy();
  if (healthy) {
    return { success: true, message: 'Proxy already running on port 8082' };
  }

  // Spawn new process
  const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
  const envPath = path.join(claudeDir, '.env');

  let envVars = {};
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (err) {
    // .env may not exist — proceed with system env
  }

  const env = { ...process.env, ...envVars };

  proxyProcess = spawn('node', [PROXY_PATH], {
    cwd: claudeDir,
    env,
    detached: false,
    windowsHide: process.platform === 'win32'
  });

  const logStream = fs.createWriteStream(PROXY_LOG, { flags: 'a' });
  proxyProcess.stdout.pipe(logStream);
  proxyProcess.stderr.pipe(logStream);

  proxyProcess.on('error', (err) => {
    proxyProcess = null;
    throw new Error('Spawn failed: ' + err.message);
  });

  let exitedCode = null;
  proxyProcess.on('exit', (code) => {
    exitedCode = code;
    proxyProcess = null;
  });

  // Wait 2.5s then check status
  await new Promise(r => setTimeout(r, 2500));

  if (exitedCode !== null) {
    // Process exited — maybe EADDRINUSE. Re-check health.
    const nowHealthy = await isProxyHealthy();
    if (nowHealthy) {
      return { success: true, message: 'Proxy already running (port occupied, health confirmed)' };
    }
    // Read last few lines of log for error detail
    let lastLog = '';
    try {
      const lines = fs.readFileSync(PROXY_LOG, 'utf8').split('\n');
      lastLog = lines.slice(-5).join(' ');
    } catch (_) {}
    throw new Error(`Proxy exited (code ${exitedCode}). ${lastLog}`);
  }

  if (proxyProcess && !proxyProcess.killed) {
    return { success: true, message: 'Proxy started successfully', pid: proxyProcess.pid };
  }

  throw new Error('Proxy failed to start (unknown state)');
});

// Stop proxy server
ipcMain.handle('stop-proxy', async () => {
  if (proxyProcess) {
    proxyProcess.kill('SIGTERM');
    proxyProcess = null;
    return { success: true, message: 'Proxy stopped' };
  }
  // Try to kill any existing proxy process (started externally)
  const command = process.platform === 'win32'
    ? 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq proxy-server*"'
    : 'pkill -f proxy-server.mjs';
  try {
    require('child_process').execSync(command, { stdio: 'ignore' });
  } catch (_) {
    // pkill returns non-zero if no process found — that's fine
  }
  return { success: true, message: 'Proxy stop signal sent' };
});

// Get proxy status
ipcMain.handle('get-proxy-status', async () => {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get(`${PROXY_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ running: true, health: JSON.parse(data), pid: proxyProcess ? proxyProcess.pid : null });
        } catch (_) {
          resolve({ running: true, health: {}, pid: proxyProcess ? proxyProcess.pid : null });
        }
      });
    });
    req.on('error', () => resolve({ running: false, health: {}, pid: null }));
    req.setTimeout(2000, () => { req.destroy(); resolve({ running: false, health: {}, pid: null }); });
  });
});

// Get logs
ipcMain.handle('get-logs', async (event, lines = 50) => {
  return new Promise((resolve) => {
    try {
      const logContent = fs.readFileSync(PROXY_LOG, 'utf8');
      const logLines = logContent.split('\n').slice(-lines);
      resolve(logLines.join('\n'));
    } catch (err) {
      resolve('No logs available');
    }
  });
});

// Open log file in editor
ipcMain.handle('open-log-file', async () => {
  shell.openPath(PROXY_LOG);
});

// Open config directory
ipcMain.handle('open-config-dir', async () => {
  const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
  shell.openPath(claudeDir);
});

// Save configuration
ipcMain.handle('save-config', async (event, config) => {
  return new Promise((resolve) => {
    try {
      store.set('config', config);
      resolve({ success: true });
    } catch (err) {
      resolve({ success: false, message: err.message });
    }
  });
});

// Load configuration
ipcMain.handle('load-config', async () => {
  return store.get('config', {});
});

// Export configuration
ipcMain.handle('export-config', async (event, config) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Configuration',
    defaultPath: `claude-proxy-config-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true, path: filePath };
  }
  return { success: false };
});

// Show message box
ipcMain.handle('show-message', async (event, options) => {
  return dialog.showMessageBox(mainWindow, options);
});

// App lifecycle
app.whenReady().then(() => {
  // Register app:// protocol to serve src/ files via HTTP (fixes XHR in packaged app)
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath = url.pathname;
    if (filePath === '/' || filePath === '//') filePath = '/index.html';
    const fullPath = path.join(__dirname, 'src', filePath);

    // Determine MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.jsx': 'text/plain',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    const contentType = mimes[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(fullPath);
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
    } catch (e) {
      return new Response('Not found: ' + filePath, { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop proxy before quitting
  if (proxyProcess) {
    proxyProcess.kill('SIGTERM');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up proxy process
  if (proxyProcess) {
    proxyProcess.kill('SIGTERM');
  }
});
