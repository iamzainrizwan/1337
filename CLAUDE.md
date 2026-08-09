# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

1337 is a self-hosted, single-user spaced-repetition tracker for the NeetCode 150/250 LeetCode problems. Solve a problem, get nudged to review it at day 1, week 1, and week 3, and receive a daily email digest of what's due. It's a small Flask app meant to run as one Docker container on a home server (LAN/Tailscale only, no auth).

## Running it

```bash
cp .env.example .env          # fill in RESEND_API_KEY / DIGEST_TO_EMAIL etc.
docker compose up -d --build  # only supported way to run this; listens on host port 5150
```

There is no test suite or linter for `app.py`/`digest.py`. The backend is a plain Flask **JSON API** (every route returns `jsonify(...)`, no server-side templates) serving a **Vite + React + TypeScript SPA** built from `frontend/`. The Dockerfile builds the SPA (`frontend/dist`) and bakes it into the image; `app.py`'s catch-all `serve_spa()` route serves it (injecting a `<base>` tag so it still works behind a reverse-proxy path prefix via `X-Forwarded-Prefix`).

To iterate locally without Docker you need both halves running:
- Backend: `pip install -r requirements.txt` and run `python app.py` (dev server on port 5000, `debug=True`). `DB_PATH` is hardcoded to `/data/tracker.db` in both `app.py` and `digest.py`, so you need a writable `/data` directory (or a symlink) when running outside the container.
- Frontend: `cd frontend && npm install && npm run dev` (Vite dev server; `vite.config.ts` proxies `/api` to `http://localhost:5000`, matching the Flask dev server's default port). `npm run build` runs `tsc -b && vite build`; `npm run lint` runs `oxlint`.

## Architecture

- **`app.py`** — the whole Flask API: routes (all under `/api/...`), SQLite schema/migrations (`init_db()`, run on import), and the pacing-math engine (`get_pacing()`). Starts an in-process APScheduler job (`start_scheduler()`) that fires the daily digest. Also serves the built SPA via a catch-all route.
- **`digest.py`** — standalone module for the "what's due today" email. Queries the same SQLite DB independently (its own connection, not Flask's `g`), renders an inline-styled HTML email, and sends via Resend. Importable and callable without the Flask app running.
- **`problems_data.py`** — static seed data: `NEETCODE_250`, a list of `(category, [(name, difficulty, url), ...])` tuples in NeetCode roadmap order, plus `CORE_150_URLS` marking which of those 250 belong to the original 150 ("core" pool vs "extra" bonus pool), and `COMPANY_TAGS_SEED` (URL → comma-separated company names) for the one-time company-tags seed — see "Company tags" below.
- **`frontend/`** — the actual UI: Vite + React + TypeScript, Tailwind CSS, shadcn/ui components (`frontend/src/components/ui/`), Recharts for charts, framer-motion for animation, react-router-dom for routing. Data fetching goes through TanStack Query, with the API surface centralized in `frontend/src/api/client.ts` (+ `types.ts`) and wrapped in hooks in `frontend/src/hooks/use-api.ts` — routes/components should call the hooks, not `fetch` directly.

### Data model (SQLite, `/data/tracker.db`)

- `problems` — seeded from `problems_data.py` on every startup via `init_db()`. Rows are matched/upserted **by LeetCode URL**, not deleted and recreated — so editing `problems_data.py` (reordering, recategorizing, adding problems) and redeploying is always safe and never wipes review history in `progress`/`review_log`. `pool` is `core`/`extra`/`custom`; `custom` rows are user-added via `POST /api/problems/add` (not seeded, not touched by `init_db()`).
- `progress` — one row per problem once started: `status` (`not_started` / `reviewing` / `mastered`), `stage` (0-3), `next_review_at`. This is the live spaced-repetition state.
- `review_log` — append-only history of every completed review (including backfilled ones), used for audit/history rather than scheduling.
- `companies` / `problem_companies` — a many-to-many tag: `companies` (`id`, `name` unique case-insensitively) and a join table `problem_companies` (`problem_id`, `company_id`). See "Company tags" below.
- `settings` — key/value pairs: `goal_start_date` (set once on first-ever run, never touched again; all pacing math is relative to it), `target_date` (editable via `/api/goal`), `timezone` (seeded from the container's `TZ` env var, editable via `/api/settings/timezone` — see "Timezone and day boundary" below), and `company_tags_seeded` (guards the one-time company-tags seed, same pattern as `goal_start_date`).

### The review state machine

Stage transitions and gap days are centralized in `app.py`'s `STAGE_INFO` dict (stage 0→1 = day 1, 1→2 = week 1, 2→3 = 3 weeks; completing stage 3 = `mastered`). Three routes drive it:

- `POST /api/solve/<id>` — first solve, jumps straight to stage 1.
- `POST /api/review/<id>/<action>` — `action` is `done` (advance a stage, or `mastered` past stage 3) or `struggled` (reset to stage 1 / next-day review instead of advancing). Every gap is computed from **today**, not the original due date, so late reviews shift subsequent dates out rather than compounding.
- `POST /api/backfill` — reconstructs `progress` + `review_log` state for a problem already solved before this app existed, given a completed stage and date; computes the correct `next_review_at` from that historical date exactly as if it had gone through the app.

### Company tags

Companies aren't a column on `problems` — they're the `companies`/`problem_companies` many-to-many relationship above. `GET`/`POST /api/companies` list/create companies (create is get-or-create, case-insensitive, returns the canonical stored name+id either way); `DELETE /api/companies/<id>` removes a company and every tag referencing it. `POST`/`DELETE /api/problems/<id>/companies[/<company_id>]` tag/untag one problem. Every endpoint that returns a `Problem` (`GET /api/problems`, `/api/dashboard`'s due/upcoming/suggested lists, `/api/backfill/candidates`) attaches a `companies: [{id, name}]` array via the shared `_attach_companies()` helper — the frontend type declares `companies` as always-present, not optional, so a new `Problem`-returning endpoint must go through it (or, like `POST /api/problems/add` for a freshly-created problem, set `companies: []` directly).

Seed data: `COMPANY_TAGS_SEED` in `problems_data.py` is applied exactly once (guarded by the `company_tags_seeded` setting), sourced from a community-compiled GitHub dataset of candidate-reported interview experiences across ~18 well-known companies — not LeetCode's own data, and not split by intern/new-grad/experienced or by OA/phone/onsite. Treat a tag as "reported somewhere, at some level," not a guarantee for any specific interview round.

Frontend: `CompanyChips` (`frontend/src/components/company-chips.tsx`) renders a problem's companies inline, collapsed to 3 names + a clickable "+N more". Read-only (plain text) unless the caller passes `editable` — only `frontend/src/pages/problems.tsx` does, where expanding also reveals per-company remove buttons and an "Add company" select; the dashboard renders the same component read-only. `ManageCompaniesDialog` (`frontend/src/components/manage-companies-dialog.tsx`) is the separate add/delete-a-company UI.

### Pacing math (`get_pacing()` in `app.py`)

Goal: all `core` (150) problems mastered within `GOAL_TARGET_DAYS` (default 60, env-configurable, only used to seed `target_date` on first run — `target_date` is freely editable afterward). Each call recomputes a fresh linear rate: `required_rate_today = remaining_unstarted / days_remaining`, where `remaining_unstarted` counts core problems still at `not_started`. `suggested_new_count` is `ceil(required_rate_today)` capped at `remaining_unstarted`; `unrealistic` flags a required rate above 8 new problems/day. This function only considers the `core` pool; `extra` (bonus) and `custom` (user-added) problems don't factor into goal pacing.

**Personal deferral (temporary, 2026-08):** `IN_SCOPE_SQL` in `app.py` marks the `Math & Geometry`/`Bit Manipulation` categories and any `Hard`-difficulty problem as lower-yield for internship interviews and costlier per problem than the flat pacing math accounts for, given the Sept 1 internship-application deadline. It only blocks *starting new* ones — `target_count` shrinks by however many matching problems are currently `not_started` (recomputed fresh each call, same as everything else here), and `get_suggested_new_problems()` skips them. `actual_started`/`actual_mastered`/`actual_weighted` are deliberately left unfiltered: a deferred-category problem already started (e.g. a Hard mid-review) keeps counting normally rather than being retroactively excluded — the deferral is about what to pick up next, not abandoning progress already made. Per-category progress and the Stats difficulty breakdown are untouched by this and still show every category/difficulty at its real state. Full reasoning in `~/vault/projects/1337.md`. To end the deferral, delete `IN_SCOPE_SQL` and its usages.

Progress bars in the UI don't use `actual_mastered`/`target_count` directly — they use `actual_weighted` (and per-category `weighted`), a 0-4 credit per problem (`not_started=0` ... `mastered=4`) so a problem mid-review shows partial progress instead of registering as 0% until fully mastered.

### Stats and streak (`/api/stats`, `get_streak()` in `app.py`)

`get_activity_by_day()` builds the activity heatmap over the **entire** history from the first-ever solve/review to today (not a fixed lookback window), so `get_streak()`'s grace-period math is never truncated by an arbitrary cutoff. The streak walks backward from today counting consecutive active days, forgiving one missed day within the first 7 days of a run and banking another skip for every further 7 days survived — a brand-new streak gets its first skip immediately rather than having to earn it. There's no stored streak counter: it's recomputed fresh from `review_log` on every call, so it self-corrects retroactively across any past gap once that gap qualifies for grace. `get_burndown_series()` derives actual-vs-ideal cumulative solve counts from the same `pacing` start/target dates for the burndown chart.

### Timezone and day boundary

The app's "day" runs 3am-3am (`DAY_START_HOUR` in `app.py`) rather than midnight-midnight, and "today" is computed in a configurable timezone (`settings.timezone`, editable via `GET`/`POST /api/settings/timezone`, defaulting to the container's `TZ` env var on first run) rather than the OS clock directly. `today_str()`/`local_today()` in `app.py` are the canonical "what day is it" helpers — everything that needs today's date (due dates, streaks, pacing, review scheduling) goes through them, not bare `date.today()`. `digest.py` keeps its own DB connection (see above) so it duplicates a small equivalent `today_str()` rather than importing from `app.py`. `start_scheduler()`'s APScheduler cron job also reads `settings.timezone` so the digest fires in the configured zone.

### Digest scheduling

The daily email is an in-process APScheduler cron job started at import time (`start_scheduler()`), not a separate cron container. **This is why the container must run gunicorn with exactly one worker** (`--workers 1` in the Dockerfile) — multiple workers would each start their own scheduler and send duplicate emails. If more concurrency is ever needed, the intended fix is to move scheduling to an external trigger hitting `POST /api/digest/send-now`, not to add workers.

Digest send is a no-op (with a log line) if `RESEND_API_KEY` or `DIGEST_TO_EMAIL` isn't set — the rest of the app works fine without email configured.
