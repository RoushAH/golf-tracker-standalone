export const DEFAULT_TOTAL_BALLS = 9;

// Drills created before the form collected a ball count have no metadata, and the app
// has always read them as 9 balls (the built-in Par 18 count). Keep that reading so
// those drills don't change under the user, and keep it in one place.
export function totalBallsFor(drill) {
  return drill.metadata?.total_balls || DEFAULT_TOTAL_BALLS;
}
