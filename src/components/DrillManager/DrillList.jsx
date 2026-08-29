import { totalBallsFor } from '../../services/strokeCount';
import { targetStreakFor } from '../../services/streak';
import './DrillManager.css';

// Stroke-count drills are measured in balls, streak drills by their target; the rest
// are described by how many categories they split attempts across.
function describeScope(drill) {
  if (drill.scoring_type === 'stroke_count') {
    return `${totalBallsFor(drill)} balls`;
  }
  if (drill.scoring_type === 'consecutive_streak') {
    return `${targetStreakFor(drill)} in a row`;
  }
  const count = drill.categories.length;
  return `${count} ${count === 1 ? 'category' : 'categories'}`;
}

export default function DrillList({ drills, onSelectDrill, onViewResults, onDeleteDrill }) {
  if (drills.length === 0) {
    return <div className="empty-state">No drills yet. Create your first drill!</div>;
  }

  return (
    <div className="drill-list">
      {drills.map(drill => (
        <div key={drill.id} className="drill-card">
          <div className="drill-header">
            <div>
              <h3>{drill.name}</h3>
              <p className="drill-description">{drill.description}</p>
              <div className="drill-meta">
                <span className="badge">{drill.scoring_type.replace('_', ' ')}</span>
                <span className="category-count">{describeScope(drill)}</span>
              </div>
            </div>
            {!drill.is_default && (
              <button
                className="delete-btn"
                onClick={() => onDeleteDrill(drill.id)}
                title="Delete drill"
              >
                🗑️
              </button>
            )}
          </div>
          <div className="drill-actions">
            <button className="btn-secondary" onClick={() => onSelectDrill(drill)}>
              Start Practice
            </button>
            <button className="btn-secondary" onClick={() => onViewResults(drill)}>
              View Results
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
