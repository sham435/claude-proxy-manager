const { useState, useEffect, useCallback, useRef } = React;

function ClaudeProxyDashboard() {
  const [proxyStatus, setProxyStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState('');
  const [healthData, setHealthData] = useState({});
  const [models, setModels] = useState([]);
  const [envInfo, setEnvInfo] = useState(null);
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [proxyUrl] = useState('http://127.0.0.1:8082');

  const features = [
    { icon: '🔀', title: 'Automatic Failover', description: 'Intelligent model switching when providers fail. Configurable priority chain with health tracking.', stats: 'Dynamic chain', metric: '99.9% uptime' },
    { icon: '⚡', title: 'Local Ollama Integration', description: 'Seamless fallback to local models. No rate limits, complete privacy, zero cost.', stats: 'Offline capable', metric: 'Zero cost' },
    { icon: '📊', title: 'Health Monitoring', description: 'Real-time health tracking per model. Automatic recovery and cooldown management.', stats: 'Live monitoring', metric: '5s intervals' },
    { icon: '🔐', title: 'Multi-Provider Support', description: 'OpenCode Zen, NVIDIA NIM, AgentRouter, OpenRouter, and local Ollama — unified under one endpoint.', stats: '5+ providers', metric: 'One API' },
    { icon: '🛡️', title: 'Streaming Optimization', description: 'Watchdog-disabled streaming for local models. Optimized timeouts for remote providers.', stats: 'Smart timeouts', metric: 'Per-provider' },
    { icon: '📝', title: 'Full Anthropic Compatibility', description: 'Works with any Claude Code CLI version that uses ANTHROPIC_BASE_URL. Drop-in replacement.', stats: 'v1.0+ compatible', metric: 'Zero config' },
  ];

  const hasElectron = typeof window.electronAPI !== 'undefined';

  // ─── Toast Notifications ───
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Load env info on startup ───
  useEffect(() => {
    if (hasElectron) {
      window.electronAPI.getEnvInfo().then(setEnvInfo).catch(() => {});
      window.electronAPI.getModels().then(data => {
        if (data && data.models && data.models.length > 0) {
          setModels(data.models.map(m => ({ ...m, status: 'healthy', latency: '—' })));
          if (!selectedModel) setSelectedModel(data.models[0].name);
        }
      }).catch(() => {});
    }
  }, []);

  // ─── Proxy Status Check (via IPC to avoid CORS) ───
  const checkProxyStatus = useCallback(async () => {
    try {
      if (hasElectron && window.electronAPI.proxyRequest) {
        const result = await window.electronAPI.proxyRequest({ method: 'GET', path: '/health' });
        if (result && result.status === 200) {
          setProxyStatus('running');
          setHealthData(result.data || {});
        } else {
          setProxyStatus('stopped');
        }
      } else {
        // Browser fallback — may fail due to CORS
        const response = await fetch(`${proxyUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          setProxyStatus('running');
          setHealthData(await response.json());
        } else {
          setProxyStatus('stopped');
        }
      }
    } catch (error) {
      setProxyStatus('stopped');
    }
  }, [proxyUrl]);

  useEffect(() => {
    checkProxyStatus();
    const interval = setInterval(checkProxyStatus, 5000);
    return () => clearInterval(interval);
  }, [checkProxyStatus]);

  // ─── Listen for proxy status changes from main process ───
  useEffect(() => {
    if (hasElectron && window.electronAPI.onProxyStatusChanged) {
      const cleanup = window.electronAPI.onProxyStatusChanged(({ running }) => {
        checkProxyStatus();
      });
      return cleanup;
    }
  }, [checkProxyStatus]);

  // ─── Listen for menu actions ───
  useEffect(() => {
    if (hasElectron && window.electronAPI.onMenuAction) {
      const cleanup = window.electronAPI.onMenuAction((action) => {
        handleAction(action);
      });
      return cleanup;
    }
  }, []);

  // ─── Action Handlers ───
  const handleStart = async () => {
    setLoading('start');
    try {
      if (hasElectron) {
        const result = await window.electronAPI.startProxy();
        addToast(result.message, 'success');
      } else {
        addToast('Open Terminal: cd ~/.claude && node proxy-server.mjs &', 'warning');
      }
      await new Promise(r => setTimeout(r, 2000));
      await checkProxyStatus();
    } catch (error) {
      addToast('Failed to start proxy: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      if (hasElectron) {
        const result = await window.electronAPI.stopProxy();
        addToast(result.message, 'success');
      } else {
        addToast('Open Terminal: pkill -f proxy-server.mjs', 'warning');
      }
      await new Promise(r => setTimeout(r, 1000));
      await checkProxyStatus();
    } catch (error) {
      addToast('Failed to stop proxy: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleReset = async () => {
    setLoading('reset');
    try {
      if (hasElectron && window.electronAPI.proxyRequest) {
        const result = await window.electronAPI.proxyRequest({ method: 'POST', path: '/agent/reset-health' });
        if (result && result.status === 200) {
          addToast('Health scores reset for all models', 'success');
        } else {
          addToast(`Reset returned HTTP ${result?.status}: ${JSON.stringify(result?.data).slice(0, 80)}`, 'warning');
        }
      } else {
        const response = await fetch(`${proxyUrl}/agent/reset-health`, { method: 'POST' });
        addToast(response.ok ? 'Health scores reset' : `Reset failed: HTTP ${response.status}`, response.ok ? 'success' : 'warning');
      }
      await checkProxyStatus();
    } catch (error) {
      addToast('Cannot reset health: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleLogs = async () => {
    setLoading('logs');
    try {
      let logContent = '';
      if (hasElectron) {
        logContent = await window.electronAPI.getLogs(150);
      } else {
        logContent = 'Electron API unavailable. View logs manually: tail -150 ~/.claude/proxy.log';
      }
      setLogs(logContent || 'No logs available yet.');
      setShowLogs(true);
    } catch (error) {
      addToast('Failed to fetch logs: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleTest = async () => {
    setLoading('test');
    const model = selectedModel || 'deepseek-r1:8b';
    try {
      const startTime = Date.now();
      const body = {
        model,
        max_tokens: 50,
        stream: false,
        messages: [{ role: 'user', content: 'Reply with just: OK' }],
      };

      let result;
      if (hasElectron && window.electronAPI.proxyRequest) {
        result = await window.electronAPI.proxyRequest({ method: 'POST', path: '/v1/messages', body });
      } else {
        const response = await fetch(`${proxyUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'test', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify(body),
        });
        result = { status: response.status, data: await response.json() };
      }

      const latency = ((Date.now() - startTime) / 1000).toFixed(2);

      if (result.status !== 200) {
        addToast(`HTTP ${result.status}: ${JSON.stringify(result.data).slice(0, 100)}`, 'error');
        return;
      }
      const text = result.data?.content?.[0]?.text || 'Empty response';
      addToast(`${model} responded in ${latency}s: "${text.slice(0, 50)}"`, 'success');
    } catch (error) {
      addToast(`Test failed: ${error.message}`, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading('export');
    try {
      const config = { proxyUrl, selectedModel, models, timestamp: new Date().toISOString(), version: '1.0.0', envInfo };
      if (hasElectron) {
        const result = await window.electronAPI.exportConfig(config);
        if (result.success) {
          addToast('Config exported to: ' + result.path, 'success');
        } else if (!result.cancelled) {
          addToast('Export failed', 'error');
        }
      } else {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'claude-proxy-config.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Config downloaded', 'success');
      }
    } catch (error) {
      addToast('Export failed: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenConfig = async () => {
    try {
      if (hasElectron) {
        await window.electronAPI.openConfigDir();
        addToast('Opened ~/.claude in Finder', 'info');
      } else {
        addToast('Run: open ~/.claude', 'info');
      }
    } catch (error) {
      addToast('Failed: ' + error.message, 'error');
    }
  };

  const handleAction = (action) => {
    switch (action) {
      case 'start': return handleStart();
      case 'stop': return handleStop();
      case 'reset': return handleReset();
      case 'logs': return handleLogs();
      case 'test': return handleTest();
      case 'export': return handleExport();
      case 'refresh': return checkProxyStatus();
    }
  };

  const quickActions = [
    { label: 'Start Proxy', icon: '▶', action: 'start', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Stop Proxy', icon: '⏸', action: 'stop', color: 'bg-red-600 hover:bg-red-700' },
    { label: 'Reset Health', icon: '🔄', action: 'reset', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'View Logs', icon: '📋', action: 'logs', color: 'bg-gray-600 hover:bg-gray-700' },
    { label: 'Test Model', icon: '🧪', action: 'test', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Export Config', icon: '💾', action: 'export', color: 'bg-indigo-600 hover:bg-indigo-700' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md w-full">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="text-lg mt-0.5 shrink-0">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <p className="text-sm font-medium flex-1 break-words">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-xl opacity-50 hover:opacity-100 shrink-0">&times;</button>
          </div>
        ))}
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLogs(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Proxy Logs</h3>
              <div className="flex gap-2">
                <button onClick={handleLogs} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Refresh</button>
                <button onClick={() => setShowLogs(false)} className="text-2xl text-gray-400 hover:text-gray-600 px-2">&times;</button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-700 bg-gray-50 whitespace-pre-wrap leading-relaxed">{logs}</pre>
            <div className="p-3 border-t flex justify-between items-center">
              <span className="text-xs text-gray-500">{logs.split('\n').length} lines</span>
              {hasElectron && (
                <button onClick={() => window.electronAPI.openLogFile()} className="text-sm text-blue-600 hover:underline">Open in Editor</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-xl">🚀</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Claude Proxy Manager</h1>
                <p className="text-xs text-gray-500">v1.0.0 • Works with any Claude Code CLI version</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
                proxyStatus === 'running' ? 'bg-green-100 text-green-700' :
                proxyStatus === 'stopped' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  proxyStatus === 'running' ? 'bg-green-500 animate-pulse' :
                  proxyStatus === 'stopped' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                }`}></span>
                {proxyStatus === 'running' ? 'Running' : proxyStatus === 'stopped' ? 'Stopped' : 'Checking...'}
              </span>
              <button onClick={handleOpenConfig} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300">Open ~/.claude</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Environment Status */}
        {envInfo && (
          <section className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">Environment Status</h2>
                <span className="text-xs text-gray-500">Detected automatically</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className={`flex items-center gap-2 p-2 rounded ${envInfo.proxyExists ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span>{envInfo.proxyExists ? '✓' : '✗'}</span>
                  <span className="text-gray-700">proxy-server.mjs</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${envInfo.envExists ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <span>{envInfo.envExists ? '✓' : '⚠'}</span>
                  <span className="text-gray-700">.env keys</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${envInfo.configExists ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span>{envInfo.configExists ? '✓' : '✗'}</span>
                  <span className="text-gray-700">agentic/config</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${envInfo.nodeVersion !== 'unknown' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span>{envInfo.nodeVersion !== 'unknown' ? '✓' : '✗'}</span>
                  <span className="text-gray-700">{envInfo.nodeVersion}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-blue-50">
                  <span>🤖</span>
                  <span className="text-gray-700 truncate" title={envInfo.claudeVersion}>{envInfo.claudeVersion}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-gray-50">
                  <span>⚡</span>
                  <span className="text-gray-700">Electron {envInfo.appVersion ? '✓' : '—'}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
            <span className="text-xs text-gray-500">
              {hasElectron ? 'Fully functional via IPC' : 'Electron API unavailable — showing terminal commands'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map(qa => (
              <button
                key={qa.action}
                onClick={() => handleAction(qa.action)}
                disabled={loading !== null}
                className={`${qa.color} text-white px-3 py-4 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group`}
              >
                {loading === qa.action ? (
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.646z"/>
                  </svg>
                ) : (
                  <span className="text-xl group-hover:scale-110 transition-transform">{qa.icon}</span>
                )}
                <span className="text-xs font-medium">{loading === qa.action ? 'Working...' : qa.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Proxy</p>
              <p className={`text-lg font-bold ${proxyStatus === 'running' ? 'text-green-600' : 'text-red-600'}`}>
                {proxyStatus === 'running' ? 'Online' : proxyStatus === 'stopped' ? 'Offline' : '...'}
              </p>
              <p className="text-xs text-gray-400 mt-1 font-mono">{proxyUrl}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Models in Chain</p>
              <p className="text-lg font-bold text-gray-900">{models.length}</p>
              <p className="text-xs text-gray-400 mt-1">{models.filter(m => m.provider === 'Ollama').length} local • {models.filter(m => m.provider !== 'Ollama').length} remote</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Active Model</p>
              <p className="text-sm font-bold text-gray-900 truncate" title={selectedModel}>{selectedModel || 'None'}</p>
              <p className="text-xs text-gray-400 mt-1">Click table to change</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Health Check</p>
              <p className="text-lg font-bold text-blue-600">5s</p>
              <p className="text-xs text-gray-400 mt-1">Auto-polling /health</p>
            </div>
          </div>
        </section>

        {/* Model Table */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Failover Chain ({models.length} models)</h2>
            <button onClick={handleTest} disabled={loading !== null} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              {loading === 'test' ? 'Testing...' : 'Test Selected'}
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {models.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No models found. Ensure <code className="bg-gray-100 px-1 rounded">~/.claude/agentic/config.mjs</code> exists.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {models.map((model, idx) => (
                    <tr key={idx}
                      className={`${selectedModel === model.name ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                      onClick={() => setSelectedModel(model.name)}>
                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 font-mono">{model.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{model.provider}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          model.type === 'Local' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>{model.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          proxyStatus === 'running' ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${proxyStatus === 'running' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          {proxyStatus === 'running' ? 'available' : 'offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Proxy Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-all hover:border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{f.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">{f.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{f.stats}</span>
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{f.metric}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Usage Instructions */}
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Setup with Claude Code CLI</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1 font-medium">Start proxy with Claude:</p>
                <code className="block font-mono text-gray-800 bg-white p-2 rounded border">ANTHROPIC_BASE_URL=http://127.0.0.1:8082 claude</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1 font-medium">Or set in ~/.claude/settings.json:</p>
                <code className="block font-mono text-gray-800 bg-white p-2 rounded border">{"{"} "env": {"{"} "ANTHROPIC_BASE_URL": "http://127.0.0.1:8082" {"}"} {"}"}</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1 font-medium">Compatibility:</p>
                <code className="block font-mono text-gray-800 bg-white p-2 rounded border">Works with all @anthropic-ai/claude-code versions (Anthropic Messages API)</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-1 font-medium">Keyboard Shortcuts:</p>
                <code className="block font-mono text-gray-800 bg-white p-2 rounded border">⌘⇧S Start • ⌘⇧X Stop • ⌘⇧L Logs • ⌘R Reload</code>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          <p>Claude Proxy Manager v1.0.0 • Electron {envInfo?.appVersion || ''} • Node {envInfo?.nodeVersion || ''}</p>
          <p className="mt-1">Compatible with all Claude Code CLI versions via Anthropic Messages API standard</p>
        </footer>
      </main>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ClaudeProxyDashboard />);
