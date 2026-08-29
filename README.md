# Golf Tracker

A standalone PWA for logging golf chipping and putting practice. Fully offline — all data
lives in IndexedDB on the device. There is no backend.

Live: https://roushah.github.io/golf-tracker-standalone/

## Running locally

```bash
npm install
npm run dev
```

The dev server binds to `0.0.0.0:5173`, so you can open it on your phone using your
machine's LAN address (e.g. `http://192.168.1.x:5173/golf-tracker-standalone/`).

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built output
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes
`dist/` to GitHub Pages. **Build output is not committed** — do not commit `dist/`.

Pages must be set to **Source: GitHub Actions** (Settings → Pages), not the legacy
"deploy from a branch". On the legacy setting Pages would serve the repo root, which now
holds the Vite source `index.html` rather than a built page.

Because the site is served from a subdirectory, `base` in `vite.config.js` must stay in
sync with the repo name. Everything downstream — asset URLs, the web manifest's
`start_url` and icon paths, and the service worker's navigation fallback — is derived
from it. Hard-coding root-absolute paths anywhere is what breaks the installed app.

## Structure

```
public/                        copied verbatim into dist/ (icons, offline.html)
src/
├── App.jsx                    view switching, drill CRUD
├── services/
│   ├── storage.js             IndexedDB access (db: golf_tracker_local)
│   ├── seed.js                built-in drills, seeded on first run
│   ├── migrations.js          idempotent fixups for records already on devices
│   ├── sessions.js            startup sweep for sessions left uncompleted
│   ├── streak.js              consecutive-streak scoring
│   └── strokeCount.js         ball-count scoring
└── components/
    ├── DrillManager/          drill list + create form
    ├── DataEntry/             recording a practice session
    ├── Results/               stats, charts, session history
    ├── DataManager/           Settings: JSON export/import
    ├── InstallPrompt/         PWA install banner
    └── Debug/                 diagnostics panel
```

### Data model

Three IndexedDB stores — `drills`, `sessions`, `results` — plus `sync_queue` and
`sync_metadata`, which are unused leftovers from an earlier client/server version.

All stores use `keyPath: 'id'` with **no** `autoIncrement`, so every record must carry an
`id` before it is written; IndexedDB throws `DataError` otherwise. IDs are minted with
`uuidv4()` at the point of creation. The built-in drill IDs in `seed.js` are hard-coded
and must never change, since stored sessions reference them via `drill_type_id`.

`DB_NAME` and `DB_VERSION` in `storage.js` must not change without a schema migration —
users already have populated databases on their devices.

`services/migrations.js` runs on every start, after seeding, and fixes up records written
by older versions of the app. It is not a schema migration: it adds no store and does not
touch `DB_VERSION`. Each fixup must be idempotent and must skip records that are already
correct, since rewriting a row bumps `updated_at` for nothing. There is one so far —
stroke-count drills created before the form collected a ball count get
`metadata.total_balls` written to the 9 the app was already assuming for them.

Drills support four scoring types:

| `scoring_type` | Entry | `metadata` |
| --- | --- | --- |
| `made_missed` | made/missed taps per category | — |
| `consecutive_streak` | made/missed taps per category, scored on the longest unbroken run | `target_streak` |
| `stroke_count` | strokes per ball, no categories (`categories: ['ball']`) | `total_balls` |
| `custom` | free outcome value — **not implemented in `DataEntry`**, currently falls through to made/missed | — |

Streaks are order-sensitive, so results carry a `sequence`. `getResultsBySession()` keys
on a random uuid and does not return records in tap order — `services/streak.js` sorts
before scoring, and anything else reading streaks must go through it. A run does not
carry across categories: each category is scored independently.

Streak drills get two charts in Results rather than one, because a longest streak says
nothing about what it cost: a best of 6 could be 6 balls or 40. So **Longest Streak** (with
the target as a reference line, and the y-axis floor raised to the target so that line
stays on screen when every session falls short) sits above **Balls per Session**. Recharts
allows one child per `ResponsiveContainer`, so two charts means two containers.

Sessions are only counted once `completed_at` is set, so an abandoned session would sit in
IndexedDB invisible to Results forever. Navigating away from Practice mid-session therefore
prompts: complete it, discard it, or keep practising. `DataEntry` hands `App` a
`{ complete, discard }` pair while a session has taps but no `completed_at` — the nav lives
in `App`, but only `DataEntry` knows the session id. Discard is `deleteSession`, which
cascades to the session's results.

There is deliberately **no resume**: re-entering Practice always starts a new session.

The prompt can only guard the in-app nav; force-quitting the app or closing the tab strands
a session with no chance to intervene. So `services/sessions.js` sweeps for those on every
start, and `App` offers the same two outcomes the prompt does — keep (stamp `completed_at`)
or discard. Two details:

- `completed_at` is dated to the **last recorded result**, not to `Date.now()`. A session
  abandoned on Tuesday should not claim it finished whenever the app next happened to open.
- Sessions with no results left, or whose drill has since been deleted, are binned without
  asking. There is nothing to show for them and nothing to decide.

The sweep runs before the first render, so the decision is made before any of that practice
could show up in Results.

### History

This app began as a client/server monorepo at
[RoushAH/golf-tracker](https://github.com/RoushAH/golf-tracker) (React client, Express
API, auth and cross-device sync). This repo is the offline-only descendant: the API,
auth, and sync layers were removed and their responsibilities moved into `storage.js`.
Cross-device transfer is now manual, via JSON export/import under Settings.

For a while this repo contained only the compiled build output, committed directly to the
root and served by Pages. It now holds the source and builds itself.

## Debug mode

Open `/enable-debug.html` on the deployed site to toggle a diagnostics panel showing
service worker, cache, and IndexedDB status. It is always on in dev.

## Icons

The install prompt needs `public/golf-icon-192.png` and `public/golf-icon-512.png`; both
are committed. To regenerate them from the SVG:

```bash
magick public/golf-icon.svg -resize 192x192 public/golf-icon-192.png
magick public/golf-icon.svg -resize 512x512 public/golf-icon-512.png
```

The icon list in the manifest lives in `vite.config.js`, not in a checked-in
`manifest.json` — the plugin generates the manifest at build time.
