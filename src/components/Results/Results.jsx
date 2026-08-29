import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { storage } from '../../services/storage';
import { summariseStreak, targetStreakFor } from '../../services/streak';
import './Results.css';

// Results recorded before a drill had categories can carry a null one; bucket those
// under 'ball' so they line up with the built-in stroke-count drill.
function categoryOf(result) {
  return result.category ?? 'ball';
}

function categoriesIn(results) {
  return [...new Set(results.map(categoryOf))];
}

export default function Results({ drill }) {
  const [stats, setStats] = useState(null);
  const [progression, setProgression] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('overall');

  useEffect(() => {
    loadResults();
  }, [drill.id]);

  useEffect(() => {
    if (stats) {
      loadProgression();
    }
  }, [selectedCategory]);

  // Completed sessions for this drill, oldest first. Everything on this screen is
  // derived from these locally - the aggregation used to happen server-side.
  async function getCompletedSessions() {
    const sessions = await storage.getSessions();
    return sessions
      .filter(s => s.drill_type_id === drill.id && !s.deleted_at && s.completed_at)
      .sort((a, b) => a.started_at - b.started_at);
  }

  async function computeStats() {
    const sessions = await getCompletedSessions();
    if (sessions.length === 0) return null;

    const withResults = await Promise.all(
      sessions.map(async session => ({
        session,
        results: await storage.getResultsBySession(session.id)
      }))
    );

    if (drill.scoring_type === 'made_missed') {
      let totalMade = 0;
      let totalAttempts = 0;
      const categories = {};

      for (const { results } of withResults) {
        for (const result of results) {
          if (result.outcome === 'made') totalMade++;
          totalAttempts++;
          if (result.category) {
            if (!categories[result.category]) {
              categories[result.category] = { made: 0, attempts: 0 };
            }
            categories[result.category].attempts++;
            if (result.outcome === 'made') categories[result.category].made++;
          }
        }
      }

      const byCategory = {};
      for (const [category, data] of Object.entries(categories)) {
        byCategory[category] = {
          ...data,
          success_rate: data.attempts > 0 ? (data.made / data.attempts) * 100 : 0
        };
      }

      return {
        total_sessions: sessions.length,
        total_attempts: totalAttempts,
        total_made: totalMade,
        success_rate: totalAttempts > 0 ? (totalMade / totalAttempts) * 100 : 0,
        by_category: byCategory
      };
    }

    if (drill.scoring_type === 'consecutive_streak') {
      const target = targetStreakFor(drill);
      let totalAttempts = 0;
      let bestStreak = 0;
      let sessionsCleared = 0;
      const categories = {};

      for (const { results } of withResults) {
        let sessionBest = 0;

        // A streak lives inside one category - switching categories mid-session doesn't
        // extend a run, so each category is scored separately.
        for (const category of categoriesIn(results)) {
          const categoryResults = results.filter(r => categoryOf(r) === category);
          const summary = summariseStreak(categoryResults, target);

          totalAttempts += summary.attempts;
          if (!categories[category]) {
            categories[category] = { attempts: 0, best_streak: 0, sessions_cleared: 0 };
          }
          const data = categories[category];
          data.attempts += summary.attempts;
          if (summary.best_streak > data.best_streak) data.best_streak = summary.best_streak;
          if (summary.target_reached) data.sessions_cleared++;
          if (summary.best_streak > sessionBest) sessionBest = summary.best_streak;
        }

        if (sessionBest > bestStreak) bestStreak = sessionBest;
        if (sessionBest >= target) sessionsCleared++;
      }

      return {
        total_sessions: sessions.length,
        total_attempts: totalAttempts,
        target,
        best_streak: bestStreak,
        sessions_cleared: sessionsCleared,
        by_category: categories
      };
    }

    if (drill.scoring_type === 'stroke_count') {
      let totalStrokes = 0;
      let totalBalls = 0;

      for (const { results } of withResults) {
        for (const result of results) {
          totalStrokes += parseInt(result.outcome) || 0;
          totalBalls++;
        }
      }

      return {
        total_sessions: sessions.length,
        total_attempts: totalBalls,
        average_strokes: totalBalls > 0 ? totalStrokes / totalBalls : 0
      };
    }

    return null;
  }

  async function computeProgression(category = null) {
    const sessions = await getCompletedSessions();
    const points = [];

    for (const session of sessions) {
      const allResults = await storage.getResultsBySession(session.id);
      const results = category ? allResults.filter(r => r.category === category) : allResults;

      // A session with nothing in the filtered category is not a data point for it.
      if (results.length === 0 && category) continue;

      if (drill.scoring_type === 'made_missed') {
        const made = results.filter(r => r.outcome === 'made').length;
        const attempts = results.length;
        points.push({
          session_id: session.id,
          started_at: session.started_at,
          total_made: made,
          total_attempts: attempts,
          success_rate: attempts > 0 ? (made / attempts) * 100 : 0
        });
      } else if (drill.scoring_type === 'consecutive_streak') {
        const target = targetStreakFor(drill);
        let best = 0;
        for (const cat of categoriesIn(results)) {
          const summary = summariseStreak(results.filter(r => categoryOf(r) === cat), target);
          if (summary.best_streak > best) best = summary.best_streak;
        }
        points.push({
          session_id: session.id,
          started_at: session.started_at,
          total_attempts: results.length,
          best_streak: best,
          target,
          target_reached: best >= target
        });
      } else if (drill.scoring_type === 'stroke_count') {
        const strokes = results.reduce((sum, r) => sum + (parseInt(r.outcome) || 0), 0);
        const balls = results.length;
        points.push({
          session_id: session.id,
          started_at: session.started_at,
          total_strokes: strokes,
          average_strokes: balls > 0 ? strokes / balls : 0
        });
      }
    }

    return points;
  }

  async function loadResults() {
    try {
      const statsData = await computeStats();
      setStats(statsData);
      setSelectedCategory('overall');
      await loadProgression();
      setLoading(false);
    } catch (error) {
      console.error('Failed to load results:', error);
      setLoading(false);
    }
  }

  async function loadProgression() {
    try {
      const category = selectedCategory === 'overall' ? null : selectedCategory;
      const progressionData = await computeProgression(category);
      setProgression(progressionData);
    } catch (error) {
      console.error('Failed to load progression:', error);
    }
  }

  async function handleDeleteSession(sessionId) {
    if (!confirm('Delete this practice session? This cannot be undone.')) return;

    try {
      await storage.deleteSession(sessionId);
      await loadResults();
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  }

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  if (!stats || stats.total_sessions === 0) {
    return (
      <div className="results">
        <h2>{drill.name} - Results</h2>
        <div className="empty-state">No practice sessions yet. Start your first session!</div>
      </div>
    );
  }

  const isStreakDrill = drill.scoring_type === 'consecutive_streak';
  // Both made/missed and streak drills split their attempts across categories.
  const usesCategoryFilter = drill.scoring_type === 'made_missed' || isStreakDrill;

  // Get categories with data for the drills that are filterable by one
  const categoriesWithData = usesCategoryFilter && stats.by_category
    ? Object.keys(stats.by_category)
    : [];

  const currentStats = selectedCategory === 'overall' ? stats : (stats.by_category?.[selectedCategory] || {});

  function chartValue(session) {
    if (drill.scoring_type === 'made_missed') return session.success_rate;
    if (isStreakDrill) return session.best_streak;
    return session.average_strokes;
  }

  function chartLabel(session) {
    if (drill.scoring_type === 'made_missed') return `${session.success_rate.toFixed(1)}%`;
    if (isStreakDrill) return `${session.best_streak} in a row`;
    return `${session.average_strokes.toFixed(2)} avg`;
  }

  // Prepare chart data
  const chartData = progression.map((session, idx) => ({
    session: idx + 1,
    date: new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: chartValue(session),
    label: chartLabel(session)
  }));

  return (
    <div className="results">
      <div className="results-header">
        <h2>{drill.name}</h2>
        <p className="session-count">{stats.total_sessions} sessions completed</p>
      </div>

      {/* Category Selector for made/missed and streak drills */}
      {usesCategoryFilter && drill.categories.length > 1 && (
        <div className="category-filter">
          <button
            className={`filter-pill ${selectedCategory === 'overall' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('overall')}
          >
            Overall
          </button>
          {drill.categories.map(cat => {
            const hasData = categoriesWithData.includes(cat);
            return (
              <button
                key={cat}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''} ${!hasData ? 'disabled' : ''}`}
                onClick={() => hasData && setSelectedCategory(cat)}
                disabled={!hasData}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      <div className="stats-overview">
        <h3>
          {selectedCategory === 'overall' ? 'Overall Statistics' : `${selectedCategory} Statistics`}
        </h3>
        <div className="stats-grid">
          {drill.scoring_type === 'made_missed' && (
            <>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall' ? stats.total_attempts : currentStats.attempts || 0}
                </div>
                <div className="stat-label">Total Attempts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall' ? stats.total_made : currentStats.made || 0}
                </div>
                <div className="stat-label">Made</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall'
                    ? stats.success_rate.toFixed(1)
                    : (currentStats.success_rate || 0).toFixed(1)}%
                </div>
                <div className="stat-label">Success Rate</div>
              </div>
            </>
          )}

          {isStreakDrill && (
            <>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall'
                    ? stats.best_streak
                    : currentStats.best_streak || 0}
                </div>
                <div className="stat-label">Best Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.target}</div>
                <div className="stat-label">Target</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall'
                    ? stats.sessions_cleared
                    : currentStats.sessions_cleared || 0}
                </div>
                <div className="stat-label">Sessions Cleared</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {selectedCategory === 'overall' ? stats.total_attempts : currentStats.attempts || 0}
                </div>
                <div className="stat-label">Total Attempts</div>
              </div>
            </>
          )}

          {drill.scoring_type === 'stroke_count' && (
            <>
              <div className="stat-card">
                <div className="stat-value">{stats.total_attempts}</div>
                <div className="stat-label">Total Balls</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.average_strokes.toFixed(2)}</div>
                <div className="stat-label">Avg Strokes</div>
              </div>
            </>
          )}
        </div>

        {selectedCategory === 'overall' && drill.scoring_type === 'made_missed' && stats.by_category && (
          <div className="by-category">
            <h4>By Category</h4>
            {drill.categories.map(cat => {
              const data = stats.by_category[cat];
              if (!data) return null;
              return (
                <div key={cat} className="category-stat">
                  <div className="category-name">{cat}</div>
                  <div className="category-bar">
                    <div
                      className="category-fill"
                      style={{ width: `${data.success_rate}%` }}
                    />
                  </div>
                  <div className="category-details">
                    {data.made}/{data.attempts} ({data.success_rate.toFixed(1)}%)
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedCategory === 'overall' && isStreakDrill && stats.by_category && (
          <div className="by-category">
            <h4>Best Streak by Category</h4>
            {drill.categories.map(cat => {
              const data = stats.by_category[cat];
              if (!data) return null;
              const progress = Math.min((data.best_streak / stats.target) * 100, 100);
              return (
                <div key={cat} className="category-stat">
                  <div className="category-name">{cat}</div>
                  <div className="category-bar">
                    <div className="category-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="category-details">
                    {data.best_streak}/{stats.target}
                    {data.sessions_cleared > 0 && ` · cleared ${data.sessions_cleared}×`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {progression.length > 0 && (
        <div className="progression">
          <h3>Progress Over Time</h3>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              {drill.scoring_type === 'made_missed' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="session"
                    label={{ value: 'Session', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">Session {payload[0].payload.session}</p>
                            <p className="tooltip-date">{payload[0].payload.date}</p>
                            <p className="tooltip-value">{payload[0].payload.label}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2e7d32"
                    strokeWidth={3}
                    dot={{ fill: '#2e7d32', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              ) : isStreakDrill ? (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="session"
                    label={{ value: 'Session', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, dataMax => Math.max(dataMax, stats.target)]}
                    label={{ value: 'Best Streak', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">Session {payload[0].payload.session}</p>
                            <p className="tooltip-date">{payload[0].payload.date}</p>
                            <p className="tooltip-value">{payload[0].payload.label}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={stats.target}
                    stroke="#2e7d32"
                    strokeDasharray="4 4"
                    label={{ value: `Target ${stats.target}`, position: 'insideTopRight', fontSize: 11, fill: '#2e7d32' }}
                  />
                  <Bar dataKey="value" fill="#1976d2" />
                </BarChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="session"
                    label={{ value: 'Session', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    label={{ value: 'Avg Strokes', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-label">Session {payload[0].payload.session}</p>
                            <p className="tooltip-date">{payload[0].payload.date}</p>
                            <p className="tooltip-value">{payload[0].payload.label}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#ff9800" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <h3>Session History</h3>
          <div className="progression-list">
            {progression.map((session, idx) => (
              <div key={session.session_id} className="session-item">
                <div className="session-info">
                  <div className="session-number">Session {idx + 1}</div>
                  <div className="session-date">
                    {new Date(session.started_at).toLocaleDateString()}
                  </div>
                  <div className="session-stats">
                    {drill.scoring_type === 'made_missed' && (
                      <>
                        <span>{session.total_made}/{session.total_attempts}</span>
                        <span className="success-rate">
                          {session.success_rate.toFixed(1)}%
                        </span>
                      </>
                    )}
                    {isStreakDrill && (
                      <>
                        <span>{session.best_streak} in a row</span>
                        <span className={session.target_reached ? 'success-rate' : ''}>
                          {session.target_reached
                            ? `🎯 cleared ${session.target}`
                            : `target ${session.target}`}
                        </span>
                      </>
                    )}
                    {drill.scoring_type === 'stroke_count' && (
                      <>
                        <span>{session.total_strokes} strokes</span>
                        <span className="avg-strokes">
                          {session.average_strokes.toFixed(2)} avg
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="delete-session-btn"
                  onClick={() => handleDeleteSession(session.session_id)}
                  title="Delete session"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
