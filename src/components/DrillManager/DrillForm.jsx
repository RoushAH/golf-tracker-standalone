import { useState } from 'react';
import './DrillManager.css';

export default function DrillForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scoringType, setScoringType] = useState('made_missed');
  const [categories, setCategories] = useState(['']);
  const [totalBalls, setTotalBalls] = useState('9');
  const [targetStreak, setTargetStreak] = useState('10');

  const usesBallCount = scoringType === 'stroke_count';
  const usesStreakTarget = scoringType === 'consecutive_streak';
  // Stroke-count drills score a fixed run of balls rather than splitting attempts
  // across categories, so the category list is neither collected nor shown for them.
  const usesCategories = !usesBallCount;

  function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please provide a drill name');
      return;
    }

    const filteredCategories = categories.filter(c => c.trim() !== '');
    if (usesCategories && filteredCategories.length === 0) {
      alert('Please provide at least one category');
      return;
    }

    const ballCount = parseInt(totalBalls, 10);
    if (usesBallCount && (!Number.isInteger(ballCount) || ballCount < 1)) {
      alert('Please provide how many balls this drill uses');
      return;
    }

    const streakTarget = parseInt(targetStreak, 10);
    if (usesStreakTarget && (!Number.isInteger(streakTarget) || streakTarget < 2)) {
      alert('Please provide a target streak of at least 2');
      return;
    }

    let metadata = null;
    if (usesBallCount) metadata = { total_balls: ballCount };
    if (usesStreakTarget) metadata = { target_streak: streakTarget };

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      scoring_type: scoringType,
      // 'ball' matches the built-in Par 18 drill, keeping result records the same
      // shape whether the drill is built in or user-created.
      categories: usesCategories ? filteredCategories : ['ball'],
      metadata
    });
  }

  function addCategory() {
    setCategories([...categories, '']);
  }

  function updateCategory(index, value) {
    const newCategories = [...categories];
    newCategories[index] = value;
    setCategories(newCategories);
  }

  function removeCategory(index) {
    setCategories(categories.filter((_, i) => i !== index));
  }

  return (
    <form className="drill-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Drill Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Short Putts Practice"
          required
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this drill..."
          rows="3"
        />
      </div>

      <div className="form-group">
        <label>Scoring Type *</label>
        <select value={scoringType} onChange={(e) => setScoringType(e.target.value)}>
          <option value="made_missed">Made/Missed</option>
          <option value="consecutive_streak">Consecutive Streak</option>
          <option value="stroke_count">Stroke Count</option>
          <option value="custom">Custom</option>
        </select>
        <small className="help-text">
          {scoringType === 'made_missed' && 'Track successful and missed attempts'}
          {scoringType === 'consecutive_streak' &&
            'Made/missed attempts, scored on your longest unbroken run of successes'}
          {scoringType === 'stroke_count' && 'Count total strokes per attempt'}
          {scoringType === 'custom' && 'Enter any outcome value'}
        </small>
      </div>

      {usesStreakTarget && (
        <div className="form-group">
          <label>Target Streak *</label>
          <input
            type="number"
            inputMode="numeric"
            min="2"
            max="999"
            value={targetStreak}
            onChange={(e) => setTargetStreak(e.target.value)}
            required
          />
          <small className="help-text">
            How many in a row counts as clearing the drill — e.g. 10 for "10/10 consecutive
            shots finish on the green".
          </small>
        </div>
      )}

      {usesCategories ? (
        <div className="form-group">
          <label>Categories *</label>
          <div className="categories-list">
            {categories.map((cat, idx) => (
              <div key={idx} className="category-input">
                <input
                  type="text"
                  value={cat}
                  onChange={(e) => updateCategory(idx, e.target.value)}
                  placeholder={`Category ${idx + 1}`}
                />
                {categories.length > 1 && (
                  <button type="button" onClick={() => removeCategory(idx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={addCategory}>
            + Add Category
          </button>
        </div>
      ) : (
        <div className="form-group">
          <label>Number of Balls *</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="99"
            value={totalBalls}
            onChange={(e) => setTotalBalls(e.target.value)}
            required
          />
          <small className="help-text">
            How many balls you play per session. Par 18, for example, uses 9.
          </small>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Create Drill
        </button>
      </div>
    </form>
  );
}
