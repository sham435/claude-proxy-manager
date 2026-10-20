const { useState, useEffect, useCallback, useRef } = React;

function ClaudeProxyDashboard() {
  const [proxyStatus, setProxyStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState('deepseek-r1:8b');
  const [healthData, setHealthData] = useState({});
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [proxyUrl] = useState('http://127.0.0.1:8082');

  const models = [
    { name: 'deepseek-r1:8b', provider: 'Ollama', type: 'Local', status: 'healthy', latency: '2.7s' },
    { name: 'nemotron-3-ultra-free', provider: 'OpenCode Zen', type: 'Free', status: 'healthy', latency: '1.2s' },
    { name: 'claude-sonnet-4-6', provider: 'AgentRouter', type: 'Free', status: 'healthy', latency: '0.8s' },
    { name: 'nvidia/llama-3.1-70b-instruct', provider: 'NVIDIA NIM', type: 'Free', status: 'healthy', latency: '1.5s' },
    { name: 'big-pickle', provider: 'OpenCode Zen', type: 'Free', status: 'warning', latency: '2.1s' },
    { name: 'minimax-m3-free', provider: 'OpenCode Zen', type: 'Free', status: 'healthy', latency: '1.8s' },
    { name: 'mimo-v2.5-free', provider: 'OpenCode Zen', type: 'Free', status: 'healthy', latency: '1.4s' },
    { name: 'nemotron-3-super-free', provider: 'OpenCode Zen', type: 'Free', status: 'healthy', latency: '1.6s' },
    { name: 'meta/llama-3.1-70b-instruct', provider: 'NVIDIA NIM', type: 'Free', status: 'healthy', latency: '1.9s' },
  ];

  const features = [
    { icon: '🔀', title: 'Automatic Failover', description: 'Intelligent model switching when providers fail. 12-model priority chain with health tracking.', stats: '12 models configured', metric: '99.9% uptime' },
    { icon: '⚡', title: 'Local Ollama Integration', description: 'Seamless fallback to local deepseek-r1:8b model. No rate limits, complete privacy.', stats: '2.7s avg response', metric: 'Zero cost' },
    { icon: '📊', title: 'Health Monitoring', description: 'Real-time health tracking per model. Automatic recovery and cooldown management.', stats: 'Live monitoring', metric: '5s intervals' },
    { icon: '🔐', title: 'Multi-Provider Support', description: 'OpenCode Zen, NVIDIA NIM, AgentRouter, Cloudflare AI, and local Ollama in one proxy.', stats: '5 providers', metric: 'Unified API' },
    { icon: '🛡️', title: 'Streaming Optimization', description: 'Watchdog-disabled streaming for local models. Optimized timeouts for remote providers.', stats: 'Zero timeouts', metric: '12s threshold' },
    { icon: '📝', title: 'Detailed Logging', description: 'Comprehensive request logging with error tracking, latency metrics, and failover chains.', stats: 'Full audit trail', metric: 'JSON format' },
  ];

  // ─── Toast Notification System ───
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Proxy Status Check ───
  const checkProxyStatus = useCallback(async () => {
    try {
      const response = await fetch(`${proxyUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        setProxyStatus('running');
        const data = await response.json();
        setHealthData(data);
      } else {
        setProxyStatus('stopped');
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

  // ─── Action Handlers ───
  const handleStart = async () => {
    setLoading('start');
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.startProxy();
        if (result && result.success) {
          addToast('Proxy started successfully (PID ' + (result.pid || 'active') + ')', 'success');
        } else {
          addToast('Proxy start response: ' + (result?.message || 'already running'), 'info');
        }
      } else {
        addToast('Electron API not available. Run: cd ~/.claude && node proxy-server.mjs &', 'warning');
      }
      // Wait and re-check status
      await new Promise(r => setTimeout(r, 2500));
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
      if (window.electronAPI) {
        const result = await window.electronAPI.stopProxy();
        addToast('Proxy stopped' + (result?.message ? ' — ' + result.message : ''), 'success');
      } else {
        addToast('Electron API not available. Run: pkill -f proxy-server.mjs', 'warning');
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
      const response = await fetch(`${proxyUrl}/agent/reset-health`, { method: 'POST' });
      if (response.ok) {
        addToast('Health scores reset for all models', 'success');
      } else {
        addToast('Reset returned status: ' + response.status, 'warning');
      }
      await checkProxyStatus();
    } catch (error) {
      addToast('Cannot reset health — proxy may be offline. ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleLogs = async () => {
    setLoading('logs');
    try {
      let logContent = '';
      if (window.electronAPI) {
        logContent = await window.electronAPI.getLogs(100);
      } else {
        const response = await fetch(`${proxyUrl}/health`);
        logContent = 'Proxy health: ' + JSON.stringify(await response.json(), null, 2);
      }
      setLogs(logContent || 'No logs available yet.');
      setShowLogs(true);
      addToast('Loaded last 100 log lines', 'info');
    } catch (error) {
      addToast('Failed to fetch logs: ' + error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleTest = async () => {
    setLoading('test');
    try {
      const startTime = Date.now();
      const response = await fetch(`${proxyUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 50,
          stream: false,
          messages: [{ role: 'user', content: 'Reply with just: OK' }]
        })
      });
      const latency = ((Date.now() - startTime) / 1000).toFixed(2);
      if (!response.ok) {
        const errBody = await response.text();
        addToast(`Model test failed (HTTP ${response.status}): ${errBody.slice(0, 100)}`, 'error');
        return;
      }
      const data = await response.json();
      const text = data.content?.[0]?.text || 'Empty response';
      addToast(`✓ ${selectedModel} responded in ${latency}s: "${text.slice(0, 60)}"`, 'success');
    } catch (error) {
      addToast(`✗ Test failed: ${error.message}`, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading('export');
    try {
      const config = {
        proxyUrl,
        selectedModel,
        models,
        features: features.map(f => f.title),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      if (window.electronAPI) {
        const result = await window.electronAPI.exportConfig(config);
        if (result && result.success) {
          addToast(`Config exported to: ${result.path}`, 'success');
        } else {
          addToast('Export cancelled', 'info');
        }
      } else {
        // Browser fallback
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claude-proxy-config-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Config exported (browser download)', 'success');
      }
    } catch (error) {
      addToast('Export failed: ' + error.message, 'error');
    } finally {
      setLoading(null);
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
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="text-lg mt-0.5">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-lg opacity-50 hover:opacity-100">×</button>
          </div>
        ))}
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLogs(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Proxy Logs (~/.claude/proxy.log)</h3>
              <button onClick={() => setShowLogs(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-700 bg-gray-50 whitespace-pre-wrap">{logs}</pre>
            <div className="p-3 border-t flex justify-between items-center">
              <span className="text-xs text-gray-500">{logs.split('\n').length} lines loaded</span>
              <button onClick={handleLogs} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Refresh</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Claude Code Proxy Manager</h1>
                <p className="mt-1 text-sm text-gray-600">Manage your local proxy server and model configurations</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
                proxyStatus === 'running' ? 'bg-green-100 text-green-800' :
                proxyStatus === 'stopped' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  proxyStatus === 'running' ? 'bg-green-500 animate-pulse' :
                  proxyStatus === 'stopped' ? 'bg-red-500' :
                  'bg-yellow-500 animate-pulse'
                }`}></span>
                <span>{proxyStatus === 'running' ? 'Running' : proxyStatus === 'stopped' ? 'Stopped' : 'Checking...'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            <span className="text-xs text-gray-500">Click to execute • Real-time feedback shown as notifications</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleAction(qa.action)}
                disabled={loading !== null}
                className={`${qa.color} text-white px-4 py-4 rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-105 flex flex-col items-center justify-center space-y-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative`}
              >
                {loading === qa.action ? (
                  <span className="text-2xl animate-spin">⚙️</span>
                ) : (
                  <span className="text-2xl group-hover:scale-110 transition-transform">{qa.icon}</span>
                )}
                <span className="text-xs font-medium">{loading === qa.action ? 'Working...' : qa.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Stats Overview */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{healthData.totalRequests || healthData.requests || '—'}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{healthData.successRate || '—'}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Latency</p>
                  <p className="text-2xl font-bold text-gray-900">{healthData.avgLatency || '—'}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Models</p>
                  <p className="text-2xl font-bold text-gray-900">{models.filter(m => m.status === 'healthy').length}/{models.length}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-blue-300">
                <div className="flex items-start space-x-4">
                  <div className="text-4xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">{feature.stats}</span>
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">{feature.metric}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Model Management */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Available Models</h2>
            <div className="flex items-center space-x-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>{model.name}</option>
                ))}
              </select>
              <button
                onClick={handleTest}
                disabled={loading !== null}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === 'test' ? 'Testing...' : 'Test Model'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {models.map((model, idx) => (
                  <tr
                    key={idx}
                    className={`${selectedModel === model.name ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                    onClick={() => setSelectedModel(model.name)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{model.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{model.provider}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        model.type === 'Local' ? 'bg-purple-100 text-purple-800' :
                        model.type === 'Free' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{model.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        model.status === 'healthy' ? 'bg-green-100 text-green-800' :
                        model.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${
                          model.status === 'healthy' ? 'bg-green-500' :
                          model.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></span>
                        {model.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{model.latency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Configuration Info */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Current Configuration</h3>
            <dl className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-sm text-gray-600">Proxy Endpoint</dt>
                <dd className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">{proxyUrl}</dd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-sm text-gray-600">Active Model</dt>
                <dd className="text-sm font-mono text-gray-900 bg-blue-100 px-2 py-1 rounded">{selectedModel}</dd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-sm text-gray-600">Ollama Endpoint</dt>
                <dd className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">127.0.0.1:11434</dd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-sm text-gray-600">Failover Chain</dt>
                <dd className="text-sm font-medium text-gray-900 bg-green-100 px-2 py-1 rounded">{models.length} models</dd>
              </div>
              <div className="flex justify-between items-center py-2">
                <dt className="text-sm text-gray-600">Proxy Status</dt>
                <dd className={`text-sm font-medium px-2 py-1 rounded ${
                  proxyStatus === 'running' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>{proxyStatus}</dd>
              </div>
              <div className="flex justify-between items-center py-2">
                <dt className="text-sm text-gray-600">Electron API</dt>
                <dd className={`text-sm font-medium px-2 py-1 rounded ${
                  window.electronAPI ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>{window.electronAPI ? 'Connected' : 'Unavailable'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Reference</h3>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Start proxy manually:</p>
                <code className="text-xs font-mono text-gray-800">cd ~/.claude && node proxy-server.mjs &</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Test with curl:</p>
                <code className="text-xs font-mono text-gray-800">curl http://127.0.0.1:8082/health</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Kill proxy:</p>
                <code className="text-xs font-mono text-gray-800">pkill -f proxy-server.mjs</code>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">View logs:</p>
                <code className="text-xs font-mono text-gray-800">tail -50 ~/.claude/proxy.log</code>
              </div>
            </div>
          </div>
        </section>

        {/* File Locations */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">File Locations</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Proxy Server</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/proxy-server.mjs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Failover Logic</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/agentic/failover.mjs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Model Config</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/agentic/config.mjs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Environment</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/.env</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Claude Settings</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/settings.json</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Proxy Logs</span>
                <span className="font-mono text-gray-900 text-xs">~/.claude/proxy.log</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-6">
          <p>Claude Code Proxy Manager v1.0.0 • Built with React + Tailwind CSS</p>
          <p className="mt-2">Supports macOS Apple Silicon & Windows 64-bit</p>
        </footer>
      </main>
    </div>
  );
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ClaudeProxyDashboard />);
