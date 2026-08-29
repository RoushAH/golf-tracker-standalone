import { useState, useEffect } from 'react';
import './DebugPanel.css';

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [swStatus, setSwStatus] = useState('checking...');
  const [cacheStatus, setCacheStatus] = useState('checking...');
  const [dbStatus, setDbStatus] = useState('checking...');

  useEffect(() => {
    checkServiceWorker();
    checkCaches();
    checkIndexedDB();

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', args.join(' '));
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', args.join(' '));
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args.join(' '));
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  function addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-50), { type, message, timestamp }]);
  }

  async function checkServiceWorker() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        setSwStatus(`✅ ${reg.active?.state || 'inactive'}`);
      } else {
        setSwStatus('❌ Not registered');
      }
    } catch (error) {
      setSwStatus('❌ Error: ' + error.message);
    }
  }

  async function checkCaches() {
    try {
      const keys = await caches.keys();
      let totalItems = 0;
      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        totalItems += requests.length;
      }
      setCacheStatus(`✅ ${keys.length} caches, ${totalItems} items`);
    } catch (error) {
      setCacheStatus('❌ Error: ' + error.message);
    }
  }

  async function checkIndexedDB() {
    try {
      const dbs = await indexedDB.databases();
      const golfDb = dbs.find(db => db.name === 'golf_tracker_local');
      if (golfDb) {
        setDbStatus(`✅ v${golfDb.version}`);
      } else {
        setDbStatus('❌ Not found');
      }
    } catch (error) {
      setDbStatus('❌ Error: ' + error.message);
    }
  }

  function clearLogs() {
    setLogs([]);
  }

  function refresh() {
    checkServiceWorker();
    checkCaches();
    checkIndexedDB();
  }

  if (!isOpen) {
    return (
      <button className="debug-toggle" onClick={() => setIsOpen(true)}>
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>🐛 Debug Panel</h3>
        <button onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="debug-section">
        <h4>System Status</h4>
        <div className="debug-status">
          <div><strong>Online:</strong> {navigator.onLine ? '✅' : '❌'}</div>
          <div><strong>Service Worker:</strong> {swStatus}</div>
          <div><strong>Cache:</strong> {cacheStatus}</div>
          <div><strong>IndexedDB:</strong> {dbStatus}</div>
          <div><strong>Origin:</strong> {window.location.origin}</div>
        </div>
        <button className="btn-refresh" onClick={refresh}>Refresh Status</button>
      </div>

      <div className="debug-section">
        <div className="debug-section-header">
          <h4>Console Logs ({logs.length})</h4>
          <button onClick={clearLogs}>Clear</button>
        </div>
        <div className="debug-logs">
          {logs.length === 0 ? (
            <div className="debug-empty">No logs yet</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`debug-log debug-log-${log.type}`}>
                <span className="debug-timestamp">{log.timestamp}</span>
                <span className="debug-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
