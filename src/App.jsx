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
  // Set by DataEntry while a session has taps in it but no completed_at: { complete, discard }.
  const [practiceInProgress, setPracticeInProgress] = useState(null);
  // The view we're trying to reach, held back until the leave prompt is answered.
  const [pendingView, setPendingView] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);

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

  // Every nav button goes through here. Leaving Practice mid-session used to just drop the
  // session: the results stayed in IndexedDB but with no completed_at, so Results ignored
  // them forever and re-entering Practice started a fresh session. Now you get asked.
  function requestView(next) {
    if (next === view) return;
    if (view === 'entry' && practiceInProgress) {
      setPendingView(next);
      return;
    }
    setView(next);
  }

  async function resolveLeave(action) {
    setIsLeaving(true);
    try {
      await practiceInProgress[action]();
      setPracticeInProgress(null);
      setView(pendingView);
      setPendingView(null);
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
      alert(`Failed to ${action} session: ${error.message}`);
    } finally {
      setIsLeaving(false);
    }
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
            onClick={() => requestView('drills')}
          >
            Drills
          </button>
          {selectedDrill && (
            <>
              <button
                className={view === 'entry' ? 'active' : ''}
                onClick={() => requestView('entry')}
              >
                Practice
              </button>
              <button
                className={view === 'results' ? 'active' : ''}
                onClick={() => requestView('results')}
              >
                Results
              </button>
            </>
          )}
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => requestView('settings')}
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
          <DataEntry
            drill={selectedDrill}
            onComplete={() => {
              setPracticeInProgress(null);
              setView('results');
            }}
            onPracticeInProgress={setPracticeInProgress}
          />
        )}

        {view === 'results' && selectedDrill && (
          <Results drill={selectedDrill} />
        )}

        {view === 'settings' && <DataManager />}
      </main>

      {pendingView && (
        <div className="modal-overlay">
          <div className="modal-content leave-prompt">
            <div className="modal-header">
              <h3>Leave this session?</h3>
            </div>
            <p>
              You've recorded practice that hasn't been completed yet. Completing it keeps it
              in your results; discarding throws it away.
            </p>
            <div className="leave-prompt-actions">
              <button
                className="btn-primary"
                onClick={() => resolveLeave('complete')}
                disabled={isLeaving}
              >
                {isLeaving ? 'Working...' : 'Complete & leave'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setPendingView(null)}
                disabled={isLeaving}
              >
                Keep practising
              </button>
              <button
                className="btn-danger"
                onClick={() => resolveLeave('discard')}
                disabled={isLeaving}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />
      {DEBUG_MODE && <DebugPanel />}
    </div>
  );
}

export default AppContent;
