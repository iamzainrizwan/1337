# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

1337 is a self-hosted, single-user spaced-repetition tracker for the NeetCode 150/250 LeetCode problems. Solve a problem, get nudged to review it at day 1, week 1, and week 3, and receive a daily email digest of what's due. It's a small Flask app meant to run as one Docker container on a home server (LAN/Tailscale only, no auth).

## Running it

```bash
cp .env.example .env          # fill in RESEND_API_KEY / DIGEST_TO_EMAIL etc.
docker compose up -d --build  # only supported way to run this; listens on host port 5150
```

There is no test suite, linter, or build step in this repo — it's plain Flask + Jinja templates + SQLite, no frontend build tooling. To iterate locally without Docker, `pip install -r requirements.txt` and run `python app.py` (dev server on port 5000, `debug=True`), but note `DB_PATH` is hardcoded to `/data/tracker.db` in both `app.py` and `digest.py`, so you need a writable `/data` directory (or create a symlink) when running outside the container.

## Architecture

Everything lives in three top-level modules plus templates — there is no package structure to navigate:

- **`app.py`** — the whole Flask app: routes, SQLite schema/migrations (`init_db()`, run on import), and the pacing-math engine (`get_pacing()`). Starts an in-process APScheduler job (`start_scheduler()`) that fires the daily digest.
- **`digest.py`** — standalone module for the "what's due today" email. Queries the same SQLite DB independently (its own connection, not Flask's `g`), renders an inline-styled HTML email, and sends via Resend. Importable and callable without the Flask app running.
- **`problems_data.py`** — static seed data: `NEETCODE_250`, a list of `(category, [(name, difficulty, url), ...])` tuples in NeetCode roadmap order, plus `CORE_150_URLS` marking which of those 250 belong to the original 150 ("core" pool vs "extra" bonus pool).

### Data model (SQLite, `/data/tracker.db`)

- `problems` — seeded from `problems_data.py` on every startup via `init_db()`. Rows are matched/upserted **by LeetCode URL**, not deleted and recreated — so editing `problems_data.py` (reordering, recategorizing, adding problems) and redeploying is always safe and never wipes review history in `progress`/`review_log`.
- `progress` — one row per problem once started: `status` (`not_started` / `reviewing` / `mastered`), `stage` (0-3), `next_review_at`. This is the live spaced-repetition state.
- `review_log` — append-only history of every completed review (including backfilled ones), used for audit/history rather than scheduling.
- `settings` — currently just `goal_start_date`, set once on first-ever run and never touched again; all pacing math is relative to it.

### The review state machine

Stage transitions and gap days are centralized in `app.py`'s `STAGE_INFO` dict (stage 0→1 = day 1, 1→2 = week 1, 2→3 = 3 weeks; completing stage 3 = `mastered`). Three routes drive it:

- `POST /solve/<id>` — first solve, jumps straight to stage 1.
- `POST /review/<id>/<action>` — `action` is `done` (advance a stage, or `mastered` past stage 3) or `struggled` (reset to stage 1 / next-day review instead of advancing). Every gap is computed from **today**, not the original due date, so late reviews shift subsequent dates out rather than compounding.
- `POST /backfill` — reconstructs `progress` + `review_log` state for a problem already solved before this app existed, given a completed stage and date; computes the correct `next_review_at` from that historical date exactly as if it had gone through the app.

### Pacing math (`get_pacing()` in `app.py`)

Goal: all `core` (150) problems mastered within `GOAL_TARGET_DAYS` (default 60, env-configurable). Because a solved problem only counts "mastered" after its 21-day review tail (`REVIEW_TAIL_DAYS = 1+7+21`), the required new-problem rate is computed against a shorter `effective_days = target_days - REVIEW_TAIL_DAYS` window, not the full target — otherwise problems started near the deadline would never finish their reviews in time. Past `effective_days`, `suggested_new_count` is forced to 0 (review-only phase). This function only considers the `core` pool; `extra` (bonus) problems don't factor into goal pacing.

### Digest scheduling

The daily email is an in-process APScheduler cron job started at import time (`start_scheduler()`), not a separate cron container. **This is why the container must run gunicorn with exactly one worker** (`--workers 1` in the Dockerfile) — multiple workers would each start their own scheduler and send duplicate emails. If more concurrency is ever needed, the intended fix is to move scheduling to an external trigger hitting `POST /digest/send-now`, not to add workers.

Digest send is a no-op (with a log line) if `RESEND_API_KEY` or `DIGEST_TO_EMAIL` isn't set — the rest of the app works fine without email configured.
