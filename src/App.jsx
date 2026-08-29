import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './services/storage';
import { seedDefaultDrills } from './services/seed';
import { runMigrations } from './services/migrations';
import DrillList from './components/DrillManager/DrillList';
import DrillForm from './components/DrillManager/DrillForm';
import DataEntry from './components/DataEntry/DataEntry';
import Results from './components/Results/Results';
import DataManager from './components/DataManager/DataManager';
import InstallPrompt from './components/InstallPrompt/InstallPrompt';
import DebugPanel from './components/Debug/DebugPanel';
import './App.css';

const DEBUG_MODE = import.meta.env.DEV || localStorage.getItem('debug_mode') === 'true';

function AppContent() {
  const [view, setView] = useState('drills');
  const [drills, setDrills] = useState([]);
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDrillForm, setShowDrillForm] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    await seedDefaultDrills();
    // After seeding, so a fresh install doesn't run fixups against an empty store.
    await runMigrations();
    await loadDrills();
    setLoading(false);
  }

  async function loadDrills() {
    try {
      const data = await storage.getDrills();
      setDrills(data);
    } catch (error) {
      console.error('Failed to load drills:', error);
    }
  }

  async function handleCreateDrill(drill) {
    try {
      const now = Date.now();
      // The id used to come back from the server's POST /drills response. With no
      // server, we mint it here - the 'drills' store has keyPath 'id' and no
      // autoIncrement, so an idless record is rejected outright by IndexedDB.
      const newDrill = {
        id: uuidv4(),
        ...drill,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      await storage.saveDrill(newDrill);
      await loadDrills();
      setShowDrillForm(false);
    } catch (error) {
      console.error('Failed to create drill:', error);
      alert('Failed to create drill');
    }
  }

  async function handleDeleteDrill(id) {
    if (!confirm('Delete this drill?')) return;
    try {
      await storage.deleteDrill(id);
      await loadDrills();
      if (selectedDrill?.id === id) {
        setSelectedDrill(null);
        setView('drills');
      }
    } catch (error) {
      console.error('Failed to delete drill:', error);
      alert('Failed to delete drill');
    }
  }

  function handleSelectDrill(drill) {
    setSelectedDrill(drill);
    setView('entry');
  }

  function handleViewResults(drill) {
    setSelectedDrill(drill);
    setView('results');
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>⛳ Golf Tracker</h1>
          <div className="header-right">
            <span className="mode-badge">📱 Local Mode</span>
          </div>
        </div>
        <nav className="app-nav">
          <button
            className={view === 'drills' ? 'active' : ''}
            onClick={() => setView('drills')}
          >
            Drills
          </button>
          {selectedDrill && (
            <>
              <button
                className={view === 'entry' ? 'active' : ''}
                onClick={() => setView('entry')}
              >
                Practice
              </button>
              <button
                className={view === 'results' ? 'active' : ''}
                onClick={() => setView('results')}
              >
                Results
              </button>
            </>
          )}
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'drills' && (
          <div className="drills-view">
            <div className="view-header">
              <h2>Your Drills</h2>
              <button className="btn-primary" onClick={() => setShowDrillForm(true)}>
                + New Drill
              </button>
            </div>

            {showDrillForm && (
              <div className="modal-overlay" onClick={() => setShowDrillForm(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Create New Drill</h3>
                    <button className="close-btn" onClick={() => setShowDrillForm(false)}>
                      ×
                    </button>
                  </div>
                  <DrillForm onSubmit={handleCreateDrill} onCancel={() => setShowDrillForm(false)} />
                </div>
              </div>
            )}

            <DrillList
              drills={drills}
              onSelectDrill={handleSelectDrill}
              onViewResults={handleViewResults}
              onDeleteDrill={handleDeleteDrill}
            />
          </div>
        )}

        {view === 'entry' && selectedDrill && (
          <DataEntry drill={selectedDrill} onComplete={() => setView('results')} />
        )}

        {view === 'results' && selectedDrill && (
          <Results drill={selectedDrill} />
        )}

        {view === 'settings' && <DataManager />}
      </main>

      <InstallPrompt />
      {DEBUG_MODE && <DebugPanel />}
    </div>
  );
}

export default AppContent;
