import { useState } from 'react';
import { storage } from '../../services/storage';
import './DataManager.css';

export default function DataManager() {
  const [status, setStatus] = useState('');
  const [lastExport, setLastExport] = useState(null);
  const [importMode, setImportMode] = useState('replace');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function getAllResults() {
    const sessions = await storage.getSessions();
    const results = [];
    for (const session of sessions) {
      results.push(...(await storage.getResultsBySession(session.id)));
    }
    return results;
  }

  async function handleExport() {
    try {
      setIsExporting(true);
      setStatus('Exporting data...');

      const drills = await storage.getDrills();
      const sessions = await storage.getSessions();
      const results = await getAllResults();

      const backup = {
        version: '1.0',
        exported_at: Date.now(),
        drill_count: drills.length,
        session_count: sessions.length,
        result_count: results.length,
        drills,
        sessions,
        results
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `golf-data-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLastExport(Date.now());
      setStatus(
        `✅ Exported ${drills.length} drills, ${sessions.length} sessions, ${results.length} results`
      );
    } catch (error) {
      console.error('Export failed:', error);
      setStatus(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }

  async function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const backup = JSON.parse(e.target.result);
          if (!backup.version) {
            throw new Error('Invalid backup file: missing version');
          }
          if (
            !Array.isArray(backup.drills) ||
            !Array.isArray(backup.sessions) ||
            !Array.isArray(backup.results)
          ) {
            throw new Error('Invalid backup file: missing or invalid data arrays');
          }
          resolve(backup);
        } catch (error) {
          reject(new Error(`Failed to parse backup file: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async function clearAllData() {
    const drills = await storage.getDrills();
    const sessions = await storage.getSessions();
    const results = await getAllResults();

    for (const result of results) await storage.deleteResult(result.id);
    for (const session of sessions) await storage.deleteSession(session.id);
    for (const drill of drills) await storage.deleteDrill(drill.id);
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setStatus('Reading backup file...');

      const backup = await readBackupFile(file);
      setStatus(
        `Importing ${backup.drills.length} drills, ${backup.sessions.length} sessions, ${backup.results.length} results...`
      );

      if (importMode === 'replace') {
        setStatus('Clearing existing data...');
        await clearAllData();
      }

      for (const drill of backup.drills) await storage.saveDrill(drill);
      for (const session of backup.sessions) await storage.saveSession(session);
      for (const result of backup.results) await storage.saveResult(result);

      setStatus(
        `✅ Successfully imported ${backup.drills.length} drills, ${backup.sessions.length} sessions, ${backup.results.length} results`
      );
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Import failed:', error);
      setStatus(`❌ Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  return (
    <div className="data-manager">
      <h2>Data Management</h2>
      <p className="description">
        Export your practice data to back it up or transfer it to another device. Import data
        from a backup file to restore or merge sessions.
      </p>

      <div className="section">
        <h3>Export Data</h3>
        <p>Download all your drills, sessions, and results as a JSON file.</p>
        <button className="btn-export" onClick={handleExport} disabled={isExporting}>
          {isExporting ? '⏳ Exporting...' : '📥 Export Data'}
        </button>
        {lastExport && (
          <p className="last-export">Last export: {new Date(lastExport).toLocaleString()}</p>
        )}
      </div>

      <div className="section">
        <h3>Import Data</h3>
        <p>Upload a backup file to restore your data.</p>
        <div className="import-mode">
          <label>
            <input
              type="radio"
              name="import-mode"
              value="replace"
              checked={importMode === 'replace'}
              onChange={e => setImportMode(e.target.value)}
            />
            <span>Replace all data</span>
          </label>
          <label>
            <input
              type="radio"
              name="import-mode"
              value="merge"
              checked={importMode === 'merge'}
              onChange={e => setImportMode(e.target.value)}
            />
            <span>Merge with existing (add new, keep existing)</span>
          </label>
        </div>
        <label className="btn-import">
          {isImporting ? '⏳ Importing...' : '📤 Import Data'}
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            disabled={isImporting}
            style={{ display: 'none' }}
          />
        </label>
        <p className="warning">
          ⚠️{' '}
          {importMode === 'replace'
            ? 'This will delete all existing data!'
            : 'Existing data will be preserved.'}
        </p>
      </div>

      {status && (
        <div
          className={`status-message ${
            status.startsWith('✅') ? 'success' : status.startsWith('❌') ? 'error' : 'info'
          }`}
        >
          {status}
        </div>
      )}

      <div className="section instructions">
        <h3>Transfer Data Between Devices</h3>
        <ol>
          <li>On your old device: Tap "Export Data" and save the file</li>
          <li>Email the file to yourself or save to cloud storage</li>
          <li>On your new device: Open the app and go to Settings</li>
          <li>Tap "Import Data" and select the backup file</li>
          <li>Choose "Replace all data" for a fresh device</li>
        </ol>
      </div>
    </div>
  );
}
