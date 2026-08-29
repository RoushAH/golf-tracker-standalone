import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../../services/storage';
import { summariseStreak, targetStreakFor } from '../../services/streak';
import { totalBallsFor } from '../../services/strokeCount';
import './DataEntry.css';

export default function DataEntry({ drill, onComplete, onPracticeInProgress }) {
  const [sessionId] = useState(uuidv4());
  const [results, setResults] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(drill.categories[0]);
  const [isCompleting, setIsCompleting] = useState(false);

  // The nav lives in App, so App is what has to intervene when you tap away from a session
  // that has taps in it but no completed_at. Hand it the two ways out - it can't build them
  // itself, since the session id only exists in here. Both read the session back out of
  // storage rather than closing over `results`, so only the empty/non-empty flip matters.
  useEffect(() => {
    if (!onPracticeInProgress) return undefined;
    onPracticeInProgress(
      results.length > 0 ? { complete: persistCompletion, discard: discardSession } : null
    );
    return () => onPracticeInProgress(null);
  }, [results.length > 0]);

  async function handleRecord(outcome) {
    const now = Date.now();
    const result = {
      id: uuidv4(),
      session_id: sessionId,
      category: currentCategory,
      outcome: outcome,
      ball_number: drill.scoring_type === 'stroke_count' ? results.length + 1 : null,
      sequence: results.length,
      recorded_at: now,
      created_at: now,
      updated_at: now,
      sync_version: 0,
      device_id: getDeviceId()
    };

    try {
      // The session row is created lazily, on the first recorded result, so
      // opening the Practice tab and backing out leaves nothing behind.
      if (results.length === 0) {
        await storage.saveSession({
          id: sessionId,
          drill_type_id: drill.id,
          started_at: now,
          completed_at: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_version: 0,
          device_id: getDeviceId()
        });
      }

      await storage.saveResult(result);
      setResults([...results, result]);
    } catch (error) {
      console.error('Failed to record result:', error);
      alert('Failed to record. Try again.');
    }
  }

  async function handleEditResult(index, newOutcome) {
    const result = results[index];
    try {
      const updated = { ...result, outcome: newOutcome, updated_at: Date.now() };
      await storage.saveResult(updated);
      const newResults = [...results];
      newResults[index] = updated;
      setResults(newResults);
    } catch (error) {
      console.error('Failed to update result:', error);
      alert('Failed to update. Try again.');
    }
  }

  async function handleDeleteResult(index) {
    const result = results[index];
    if (!confirm('Delete this result?')) return;

    try {
      await storage.deleteResult(result.id);
      setResults(results.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Failed to delete result:', error);
      alert('Failed to delete. Try again.');
    }
  }

  // Stamping completed_at is what makes a session visible to Results; until then it is
  // just rows in IndexedDB. Kept separate from handleComplete so the leave prompt in App
  // can reuse it without also triggering this screen's navigation.
  async function persistCompletion() {
    const now = Date.now();
    const session = await storage.getSession(sessionId);
    if (session) {
      // getSession() hydrates a `results` array onto the record for convenience;
      // drop it before writing back so results aren't duplicated into the row.
      const { results: _hydrated, ...record } = session;
      await storage.saveSession({ ...record, completed_at: now, updated_at: now });
    }
  }

  // deleteSession cascades to the session's results, so this leaves nothing behind.
  async function discardSession() {
    await storage.deleteSession(sessionId);
  }

  async function handleComplete() {
    if (results.length === 0) {
      alert('Record at least one result before completing');
      return;
    }

    setIsCompleting(true);
    try {
      await persistCompletion();
      onComplete();
    } catch (error) {
      console.error('Failed to complete session:', error);
      alert('Failed to complete session: ' + error.message);
      setIsCompleting(false);
    }
  }

  function getDeviceId() {
    let deviceId = localStorage.getItem('golf_tracker_device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('golf_tracker_device_id', deviceId);
    }
    return deviceId;
  }

  const categoryResults = results.filter(r => r.category === currentCategory);
  const isStreakDrill = drill.scoring_type === 'consecutive_streak';
  const streak = isStreakDrill
    ? summariseStreak(categoryResults, targetStreakFor(drill))
    : null;

  if (drill.scoring_type === 'stroke_count') {
    const totalBalls = totalBallsFor(drill);

    return (
      <div className="data-entry">
        <div className="entry-header">
          <h2>{drill.name}</h2>
          <p>{drill.description}</p>
        </div>

        <div className="stroke-count-entry">
          <div className="ball-progress">
            <div className="progress-text">
              {results.length < totalBalls ? (
                <>Ball {results.length + 1} of {totalBalls}</>
              ) : (
                <>All {totalBalls} balls complete!</>
              )}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min((results.length / totalBalls) * 100, 100)}%` }}
              />
            </div>
          </div>

          {results.length < totalBalls && (
            <div className="stroke-buttons">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(strokes => (
                <button
                  key={strokes}
                  className="stroke-btn"
                  onClick={() => handleRecord(strokes.toString())}
                >
                  {strokes}
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="results-summary">
              <h3>Results</h3>
              <div className="results-list">
                {results.map((r, idx) => (
                  <div key={r.id} className="result-row">
                    <span className="ball-label">Ball {idx + 1}:</span>
                    <div className="result-edit-group">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(strokes => (
                        <button
                          key={strokes}
                          className={`mini-stroke-btn ${r.outcome === strokes.toString() ? 'selected' : ''}`}
                          onClick={() => handleEditResult(idx, strokes.toString())}
                        >
                          {strokes}
                        </button>
                      ))}
                    </div>
                    <button
                      className="delete-result-btn"
                      onClick={() => handleDeleteResult(idx)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="total-strokes">
                Total: {results.reduce((sum, r) => sum + parseInt(r.outcome), 0)} strokes
              </div>
            </div>
          )}

          {results.length > 0 && (
            <button
              className="btn-primary btn-complete"
              onClick={handleComplete}
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing...' : 'Complete Session'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="data-entry">
      <div className="entry-header">
        <h2>{drill.name}</h2>
        <p>{drill.description}</p>
      </div>

      {drill.categories.length > 1 && (
        <div className="category-selector">
          {drill.categories.map(cat => {
            const catResults = results.filter(r => r.category === cat);
            return (
              <button
                key={cat}
                className={`category-btn ${currentCategory === cat ? 'active' : ''}`}
                onClick={() => setCurrentCategory(cat)}
              >
                {cat}
                {catResults.length > 0 && (
                  <span className="count-badge">{catResults.length}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="made-missed-entry">
        <div className="outcome-buttons">
          <button
            className="outcome-btn made"
            onClick={() => handleRecord('made')}
          >
            ✓ Made
          </button>
          <button
            className="outcome-btn missed"
            onClick={() => handleRecord('missed')}
          >
            × Missed
          </button>
        </div>

        {isStreakDrill && (
          <div className="streak-tracker">
            <div className="progress-text">
              {streak.target_reached ? (
                <>🎯 Target of {streak.target} in a row cleared!</>
              ) : (
                <>
                  {streak.current_streak} in a row — {streak.target - streak.current_streak}{' '}
                  more to clear {streak.target}
                </>
              )}
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${streak.target_reached ? 'complete' : ''}`}
                style={{
                  width: `${Math.min((streak.current_streak / streak.target) * 100, 100)}%`
                }}
              />
            </div>
          </div>
        )}

        {categoryResults.length > 0 && isStreakDrill && (
          <div className="category-stats">
            <div className="stat-card">
              <div className="stat-value">{streak.current_streak}</div>
              <div className="stat-label">Current Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{streak.best_streak}</div>
              <div className="stat-label">Best Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{streak.target}</div>
              <div className="stat-label">Target</div>
            </div>
          </div>
        )}

        {categoryResults.length > 0 && !isStreakDrill && (
          <div className="category-stats">
            <div className="stat-card">
              <div className="stat-value">
                {categoryResults.filter(r => r.outcome === 'made').length}
              </div>
              <div className="stat-label">Made</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {categoryResults.filter(r => r.outcome === 'missed').length}
              </div>
              <div className="stat-label">Missed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {((categoryResults.filter(r => r.outcome === 'made').length / categoryResults.length) * 100).toFixed(0)}%
              </div>
              <div className="stat-label">Success</div>
            </div>
          </div>
        )}

        {categoryResults.length > 0 && (
          <div className="results-list-made-missed">
            <h4>Recent ({currentCategory})</h4>
            {categoryResults.slice(-5).reverse().map((r, idx) => (
              <div key={r.id} className="result-row-inline">
                <span className={`outcome-badge ${r.outcome}`}>
                  {r.outcome === 'made' ? '✓' : '×'}
                </span>
                <button
                  className="delete-result-btn-inline"
                  onClick={() => handleDeleteResult(results.indexOf(r))}
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <button
          className="btn-primary btn-complete"
          onClick={handleComplete}
          disabled={isCompleting}
        >
          {isCompleting ? 'Completing...' : 'Complete Session'}
        </button>
      )}
    </div>
  );
}
