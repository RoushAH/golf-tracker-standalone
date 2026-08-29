import { storage } from './storage';
import { DEFAULT_TOTAL_BALLS } from './strokeCount';

// Data fixups for records already sitting on people's devices. These run on every start,
// so each one must be idempotent and must not touch records that are already correct -
// rewriting a row bumps updated_at for no reason.
//
// This is not the same thing as an IndexedDB schema migration: DB_VERSION is unchanged
// and no store is added or altered. If you ever do need that, it belongs in storage.js.

// Stroke-count drills created before the form had a "Number of Balls" field carry no
// metadata.total_balls. The app has been treating them as DEFAULT_TOTAL_BALLS all along,
// so write that down: the drill then says what it has been doing, and the reader-side
// fallback stops being the thing holding it together.
async function backfillStrokeCountBallCounts(drills) {
  const stale = drills.filter(
    d => d.scoring_type === 'stroke_count' && !d.metadata?.total_balls
  );
  if (stale.length === 0) return 0;

  for (const drill of stale) {
    await storage.saveDrill({
      ...drill,
      metadata: { ...drill.metadata, total_balls: DEFAULT_TOTAL_BALLS },
      updated_at: Date.now()
    });
  }
  return stale.length;
}

export async function runMigrations() {
  try {
    const drills = await storage.getDrills();
    const backfilled = await backfillStrokeCountBallCounts(drills);
    if (backfilled > 0) {
      console.log(`✅ Backfilled total_balls on ${backfilled} stroke-count drill(s)`);
    }
  } catch (error) {
    // A failed fixup must not stop the app booting - the reader-side fallbacks still
    // hold, so the worst case is that the data stays as it was.
    console.error('❌ Migrations failed:', error);
  }
}
