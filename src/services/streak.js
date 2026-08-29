export const DEFAULT_TARGET_STREAK = 10;

export function targetStreakFor(drill) {
  return drill.metadata?.target_streak || DEFAULT_TARGET_STREAK;
}

// Streaks are order-sensitive, and getResultsBySession() returns records keyed by a
// random uuid rather than in the order they were tapped. Always order before scoring.
export function inRecordedOrder(results) {
  return [...results].sort(
    (a, b) =>
      (a.sequence ?? 0) - (b.sequence ?? 0) || (a.recorded_at ?? 0) - (b.recorded_at ?? 0)
  );
}

// `best` is the longest unbroken run of successes; `current` is the run still alive at
// the end of the sequence, which is what the player is adding to right now.
export function summariseStreak(results, target) {
  let best = 0;
  let current = 0;

  for (const result of inRecordedOrder(results)) {
    if (result.outcome === 'made') {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  return {
    attempts: results.length,
    best_streak: best,
    current_streak: current,
    target,
    target_reached: target > 0 && best >= target
  };
}
