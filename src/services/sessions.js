import { storage } from './storage';

// A session row is written on the first recorded result and only becomes visible to Results
// once completed_at is set. Tapping away from Practice now prompts, but force-quitting the
// app or closing the tab can't be intercepted, so sessions still get stranded that way.

// Splits the stranded ones into those worth asking about and those that are just litter:
// a session with no results left, or one whose drill has since been deleted, has nothing
// to show and nothing to decide.
export async function findUnfinishedSessions() {
  const [sessions, drills] = await Promise.all([storage.getSessions(), storage.getDrills()]);
  const drillsById = new Map(drills.map(d => [d.id, d]));

  const litter = [];
  const recoverable = [];

  for (const session of sessions) {
    if (session.completed_at || session.deleted_at) continue;

    const results = await storage.getResultsBySession(session.id);
    const drill = drillsById.get(session.drill_type_id);

    if (results.length === 0 || !drill) {
      litter.push(session);
      continue;
    }

    recoverable.push({
      session,
      drill,
      attempts: results.length,
      // The session ended when the last ball was struck, not whenever the app next opens.
      lastActivityAt: results.reduce(
        (latest, r) => Math.max(latest, r.recorded_at ?? 0),
        session.started_at
      )
    });
  }

  return { litter, recoverable };
}

// Stamping completed_at is all it takes to make a session count; dated to its last recorded
// ball so a session finished on Tuesday doesn't claim it ended whenever you next opened the app.
export async function completeSessions(entries) {
  for (const { session, lastActivityAt } of entries) {
    await storage.saveSession({
      ...session,
      completed_at: lastActivityAt,
      updated_at: Date.now()
    });
  }
}

// deleteSession cascades to the session's results.
export async function discardSessions(sessions) {
  for (const session of sessions) {
    await storage.deleteSession(session.id);
  }
}
