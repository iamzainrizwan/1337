import math
import os
import sqlite3
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from flask import Flask, g, jsonify, request, send_from_directory

from problems_data import NEETCODE_250, CORE_150_URLS, COMPANY_TAGS_SEED
import digest

DB_PATH = "/data/tracker.db"
DIGEST_SEND_TIME = os.environ.get("DIGEST_SEND_TIME", "07:00")
STATIC_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")

# Default seed for target_date on first-ever run, in days from goal_start_date.
# Kept as an env var only for the initial seed -- the real source of truth
# afterward is settings.target_date, editable at runtime.
GOAL_TARGET_DAYS = int(os.environ.get("GOAL_TARGET_DAYS", "60"))

# The app's "day" runs from 3am to 3am rather than midnight to midnight, so
# a late-night session before bed still counts toward "today" instead of
# rolling over into tomorrow.
DAY_START_HOUR = 3

# stage -> (label, days until next review after completing this stage)
STAGE_INFO = {
    0: {"label": "Not started", "next_gap": None},
    1: {"label": "Day 1 review",  "next_gap": 1},   # gap to reach stage 1
    2: {"label": "Week 1 review", "next_gap": 7},   # gap to reach stage 2
    3: {"label": "3 Week review", "next_gap": 21},  # gap to reach stage 3
}

app = Flask(__name__, static_folder=None)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    os.makedirs("/data", exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS problems (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            url TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            pool TEXT NOT NULL DEFAULT 'core'
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS progress (
            problem_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'not_started',
            stage INTEGER NOT NULL DEFAULT 0,
            first_solved_at TEXT,
            next_review_at TEXT,
            last_action_at TEXT,
            FOREIGN KEY (problem_id) REFERENCES problems(id)
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS review_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_id INTEGER NOT NULL,
            stage INTEGER NOT NULL,
            completed_at TEXT NOT NULL,
            outcome TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # additive migrations for installs created before these columns existed
    cols = [r[1] for r in db.execute("PRAGMA table_info(problems)").fetchall()]
    if "pool" not in cols:
        db.execute("ALTER TABLE problems ADD COLUMN pool TEXT NOT NULL DEFAULT 'core'")

    db.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS problem_companies (
            problem_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            PRIMARY KEY (problem_id, company_id),
            FOREIGN KEY (problem_id) REFERENCES problems(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # one-off migration: the old free-text company_tags column predates the
    # normalized companies/problem_companies tables above -- split it into
    # rows once, then drop it, so it can never drift out of sync with them.
    if "company_tags" in cols:
        for row in db.execute(
            "SELECT id, company_tags FROM problems WHERE company_tags IS NOT NULL AND company_tags != ''"
        ).fetchall():
            for name in {t.strip() for t in row["company_tags"].split(",") if t.strip()}:
                db.execute("INSERT OR IGNORE INTO companies (name) VALUES (?)", (name,))
                company_id = db.execute(
                    "SELECT id FROM companies WHERE name = ? COLLATE NOCASE", (name,)
                ).fetchone()["id"]
                db.execute(
                    "INSERT OR IGNORE INTO problem_companies (problem_id, company_id) VALUES (?, ?)",
                    (row["id"], company_id),
                )
        db.execute("ALTER TABLE problems DROP COLUMN company_tags")

    order_index = 0
    for category, problems in NEETCODE_250:
        for name, difficulty, link in problems:
            pool = "core" if link in CORE_150_URLS else "extra"
            existing = db.execute("SELECT id FROM problems WHERE url = ?", (link,)).fetchone()
            if existing:
                db.execute("""
                    UPDATE problems SET name = ?, category = ?, difficulty = ?, order_index = ?, pool = ?
                    WHERE id = ?
                """, (name, category, difficulty, order_index, pool, existing[0]))
            else:
                db.execute("""
                    INSERT INTO problems (name, category, difficulty, url, order_index, pool)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (name, category, difficulty, link, order_index, pool))
            order_index += 1

    # Company tags: seeded once from a community-compiled dataset (see
    # problems_data.py), then fully user-managed via the companies API --
    # never re-applied, so it won't clobber tags the user has since edited.
    if db.execute("SELECT 1 FROM settings WHERE key = 'company_tags_seeded'").fetchone() is None:
        for link, names in COMPANY_TAGS_SEED.items():
            problem = db.execute("SELECT id FROM problems WHERE url = ?", (link,)).fetchone()
            if not problem:
                continue
            for name in {t.strip() for t in names.split(",") if t.strip()}:
                db.execute("INSERT OR IGNORE INTO companies (name) VALUES (?)", (name,))
                company_id = db.execute(
                    "SELECT id FROM companies WHERE name = ? COLLATE NOCASE", (name,)
                ).fetchone()["id"]
                db.execute(
                    "INSERT OR IGNORE INTO problem_companies (problem_id, company_id) VALUES (?, ?)",
                    (problem["id"], company_id),
                )
        db.execute("INSERT INTO settings (key, value) VALUES ('company_tags_seeded', '1')")

    # Timezone: seeded from the container's TZ env var, freely editable
    # afterward via POST /api/settings/timezone.
    if db.execute("SELECT 1 FROM settings WHERE key = 'timezone'").fetchone() is None:
        db.execute("INSERT INTO settings (key, value) VALUES ('timezone', ?)", (os.environ.get("TZ", "UTC"),))

    # Goal start date: set once, on first ever run, and never touched again.
    if db.execute("SELECT 1 FROM settings WHERE key = 'goal_start_date'").fetchone() is None:
        db.execute("INSERT INTO settings (key, value) VALUES ('goal_start_date', ?)", (today_str(db),))

    # target_date seeded once off goal_start_date + GOAL_TARGET_DAYS, then
    # freely editable afterward via PATCH /api/goal.
    if db.execute("SELECT 1 FROM settings WHERE key = 'target_date'").fetchone() is None:
        start = date.fromisoformat(get_setting_raw(db, "goal_start_date", today_str(db)))
        seeded_target = (start + timedelta(days=GOAL_TARGET_DAYS)).isoformat()
        db.execute("INSERT INTO settings (key, value) VALUES ('target_date', ?)", (seeded_target,))

    db.commit()
    db.close()


def get_setting_raw(db, key, default=None):
    row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def get_setting(key, default=None):
    return get_setting_raw(get_db(), key, default)


def get_timezone_name(db=None):
    if db is None:
        db = get_db()
    return get_setting_raw(db, "timezone", os.environ.get("TZ", "UTC"))


def local_now(db=None):
    return datetime.now(ZoneInfo(get_timezone_name(db)))


def today_str(db=None):
    """The app's 'today', in the configured timezone, with the day boundary
    at DAY_START_HOUR instead of midnight."""
    now = local_now(db)
    if now.hour < DAY_START_HOUR:
        now -= timedelta(days=1)
    return now.date().isoformat()


def local_today(db=None):
    return date.fromisoformat(today_str(db))


def row_to_dict(row):
    return dict(row) if row is not None else None


def get_pacing():
    """Deadline-based dynamic replan: how many core problems still need a
    first pass, and what rate that requires from today onward, recomputed
    fresh every call rather than compared against a fixed day-0 schedule."""
    db = get_db()
    start_date = date.fromisoformat(get_setting("goal_start_date", today_str()))
    target_date = date.fromisoformat(get_setting("target_date", today_str()))
    target_count = db.execute("SELECT COUNT(*) FROM problems WHERE pool = 'core'").fetchone()[0]

    actual_started = db.execute("""
        SELECT COUNT(*) FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core' AND pr.status != 'not_started'
    """).fetchone()[0]

    actual_mastered = db.execute("""
        SELECT COUNT(*) FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core' AND pr.status = 'mastered'
    """).fetchone()[0]

    actual_weighted = db.execute("""
        SELECT COALESCE(SUM(CASE
            WHEN pr.status = 'mastered' THEN 4
            WHEN pr.stage = 3 THEN 3
            WHEN pr.stage = 2 THEN 2
            WHEN pr.stage = 1 THEN 1
            ELSE 0 END), 0)
        FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core'
    """).fetchone()[0]

    remaining_unstarted = max(target_count - actual_started, 0)
    days_remaining = max((target_date - local_today()).days, 1)
    required_rate_today = remaining_unstarted / days_remaining

    suggested_new_count = min(math.ceil(required_rate_today), remaining_unstarted)
    unrealistic = required_rate_today > 8  # more than 8 new problems/day is not a real plan

    return {
        "start_date": start_date.isoformat(),
        "target_date": target_date.isoformat(),
        "target_count": target_count,
        "days_remaining": days_remaining,
        "required_rate_today": required_rate_today,
        "actual_started": actual_started,
        "actual_mastered": actual_mastered,
        "actual_weighted": actual_weighted,
        "remaining_unstarted": remaining_unstarted,
        "suggested_new_count": suggested_new_count,
        "unrealistic": unrealistic,
        "past_deadline": local_today() > target_date,
    }


def get_suggested_new_problems(count):
    if count <= 0:
        return []
    db = get_db()
    return db.execute("""
        SELECT p.* FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE p.pool = 'core' AND (pr.status IS NULL OR pr.status = 'not_started')
        ORDER BY p.order_index ASC
        LIMIT ?
    """, (count,)).fetchall()


def get_first_activity_date(db=None):
    if db is None:
        db = get_db()
    row = db.execute("SELECT MIN(completed_at) AS d FROM review_log").fetchone()
    return date.fromisoformat(row["d"]) if row and row["d"] else None


def get_activity_by_day():
    """Full history from the first-ever solve/review to today, rather than a
    fixed lookback window -- so the heatmap reflects the whole journey and
    the streak's grace-period math (see get_streak) isn't silently
    truncated by an arbitrary cutoff."""
    db = get_db()
    today = local_today()
    start = get_first_activity_date(db) or today
    days = (today - start).days + 1
    rows = db.execute("""
        SELECT completed_at AS day, COUNT(*) AS c
        FROM review_log
        WHERE completed_at >= ?
        GROUP BY completed_at
    """, (start.isoformat(),)).fetchall()
    counts = {r["day"]: r["c"] for r in rows}
    return [
        {"date": (start + timedelta(days=i)).isoformat(), "count": counts.get((start + timedelta(days=i)).isoformat(), 0)}
        for i in range(days)
    ]


def get_streak():
    """Walk backward from today counting consecutive active days. One missed
    day is forgiven within the first 7 days of a run, with another banked
    skip for every further 7 days survived (21 days survived = 3 banked
    skips) -- so a longer streak has more forgiveness, but even a brand-new
    one gets its first skip right away instead of having to earn it first.
    Runs over the full activity history (see get_activity_by_day), so this
    self-corrects retroactively across any past gap once it qualifies for
    the grace period -- there's no stored streak counter to get stuck in a
    stale, already-broken state."""
    activity = get_activity_by_day()
    streak = 0
    days_elapsed = 0
    misses_used = 0
    for day in reversed(activity):
        if day["date"] > today_str():
            continue
        days_elapsed += 1
        if day["count"] > 0:
            streak += 1
            continue
        allowed = (days_elapsed + 6) // 7  # ceil(days_elapsed / 7)
        if misses_used < allowed:
            misses_used += 1
            continue
        break
    return streak


def get_burndown_series():
    db = get_db()
    pacing = get_pacing()
    start_date = date.fromisoformat(pacing["start_date"])
    target_date = date.fromisoformat(pacing["target_date"])
    target_count = pacing["target_count"]

    rows = db.execute("""
        SELECT pr.first_solved_at AS day, COUNT(*) AS c
        FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core' AND pr.first_solved_at IS NOT NULL
        GROUP BY pr.first_solved_at
        ORDER BY pr.first_solved_at ASC
    """).fetchall()

    total_days = max((target_date - start_date).days, 1)
    cumulative = 0
    by_day = {r["day"]: r["c"] for r in rows}
    series = []
    day = start_date
    today = local_today()
    while day <= max(target_date, today):
        cumulative += by_day.get(day.isoformat(), 0)
        elapsed = (day - start_date).days
        ideal = min(round(target_count * elapsed / total_days), target_count) if elapsed >= 0 else 0
        series.append({
            "date": day.isoformat(),
            "actual": cumulative if day <= today else None,
            "ideal": ideal,
        })
        day += timedelta(days=1)
    return series


def get_difficulty_breakdown():
    db = get_db()
    rows = db.execute("""
        SELECT p.difficulty AS difficulty,
               COUNT(*) AS total,
               SUM(CASE WHEN pr.status = 'mastered' THEN 1 ELSE 0 END) AS mastered,
               SUM(CASE WHEN pr.status IS NOT NULL AND pr.status != 'not_started' THEN 1 ELSE 0 END) AS started
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE p.pool = 'core'
        GROUP BY p.difficulty
    """).fetchall()
    return [dict(r) for r in rows]


def get_today_activity():
    db = get_db()
    today = today_str()
    rows = db.execute("""
        SELECT p.*, rl.stage, rl.outcome
        FROM review_log rl JOIN problems p ON p.id = rl.problem_id
        WHERE rl.completed_at = ?
        ORDER BY rl.id DESC
    """, (today,)).fetchall()
    return [dict(r) for r in rows]


@app.route("/api/dashboard")
def api_dashboard():
    db = get_db()
    today = today_str()

    due = db.execute("""
        SELECT p.*, pr.stage, pr.next_review_at, pr.status
        FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE pr.status = 'reviewing' AND pr.next_review_at <= ?
        ORDER BY pr.next_review_at ASC
    """, (today,)).fetchall()

    upcoming = db.execute("""
        SELECT p.*, pr.stage, pr.next_review_at, pr.status
        FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE pr.status = 'reviewing' AND pr.next_review_at > ?
        ORDER BY pr.next_review_at ASC
        LIMIT 15
    """, (today,)).fetchall()

    totals = db.execute("SELECT COUNT(*) AS c FROM problems").fetchone()["c"]
    mastered = db.execute("SELECT COUNT(*) AS c FROM progress WHERE status = 'mastered'").fetchone()["c"]
    in_progress = db.execute("SELECT COUNT(*) AS c FROM progress WHERE status = 'reviewing'").fetchone()["c"]

    categories = db.execute("""
        SELECT p.category,
               COUNT(*) AS total,
               SUM(CASE WHEN pr.status = 'mastered' THEN 1 ELSE 0 END) AS mastered,
               SUM(CASE
                   WHEN pr.status = 'mastered' THEN 4
                   WHEN pr.stage = 3 THEN 3
                   WHEN pr.stage = 2 THEN 2
                   WHEN pr.stage = 1 THEN 1
                   ELSE 0 END) AS weighted
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE p.pool = 'core'
        GROUP BY p.category
        ORDER BY MIN(p.order_index)
    """).fetchall()

    pacing = get_pacing()
    suggested = get_suggested_new_problems(pacing["suggested_new_count"])

    return jsonify({
        "due": [dict(r) for r in due],
        "upcoming": [dict(r) for r in upcoming],
        "totals": totals,
        "mastered": mastered,
        "in_progress": in_progress,
        "categories": [dict(r) for r in categories],
        "stage_info": STAGE_INFO,
        "today": today,
        "pacing": pacing,
        "suggested": [dict(r) for r in suggested],
        "today_activity": get_today_activity(),
        "streak": get_streak(),
    })


def _companies_by_problem(db):
    rows = db.execute("""
        SELECT pc.problem_id, c.id, c.name
        FROM problem_companies pc
        JOIN companies c ON c.id = pc.company_id
    """).fetchall()
    by_problem = {}
    for r in rows:
        by_problem.setdefault(r["problem_id"], []).append({"id": r["id"], "name": r["name"]})
    for companies in by_problem.values():
        companies.sort(key=lambda c: c["name"].lower())
    return by_problem


@app.route("/api/problems")
def api_problems():
    db = get_db()
    pool_filter = request.args.get("pool", "core")
    rows = db.execute("""
        SELECT p.*, pr.status, pr.stage, pr.next_review_at
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE (? = 'all' OR p.pool = ?)
        ORDER BY p.order_index ASC
    """, (pool_filter, pool_filter)).fetchall()
    companies_by_problem = _companies_by_problem(db)
    problems = [dict(r) for r in rows]
    for p in problems:
        p["companies"] = companies_by_problem.get(p["id"], [])
    return jsonify({"problems": problems, "stage_info": STAGE_INFO})


@app.route("/api/problems/add", methods=["POST"])
def api_add_problem():
    data = request.get_json(force=True)
    db = get_db()
    max_order = db.execute("SELECT COALESCE(MAX(order_index), 0) AS m FROM problems").fetchone()["m"]
    cur = db.execute("""
        INSERT INTO problems (name, category, difficulty, url, order_index, pool)
        VALUES (?, ?, ?, ?, ?, 'custom')
    """, (
        data["name"], data["category"], data["difficulty"], data["url"],
        max_order + 1,
    ))
    db.commit()
    row = db.execute("SELECT * FROM problems WHERE id = ?", (cur.lastrowid,)).fetchone()
    result = dict(row)
    result["companies"] = []
    return jsonify(result), 201


@app.route("/api/companies")
def api_companies():
    db = get_db()
    rows = db.execute("""
        SELECT c.id, c.name, COUNT(pc.problem_id) AS problem_count
        FROM companies c
        LEFT JOIN problem_companies pc ON pc.company_id = c.id
        GROUP BY c.id
        ORDER BY c.name COLLATE NOCASE
    """).fetchall()
    return jsonify({"companies": [dict(r) for r in rows]})


@app.route("/api/companies", methods=["POST"])
def api_create_company():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    db = get_db()
    existing = db.execute("SELECT id, name FROM companies WHERE name = ? COLLATE NOCASE", (name,)).fetchone()
    if existing:
        company_id, canonical_name, status = existing["id"], existing["name"], 200
    else:
        cur = db.execute("INSERT INTO companies (name) VALUES (?)", (name,))
        db.commit()
        company_id, canonical_name, status = cur.lastrowid, name, 201
    count = db.execute(
        "SELECT COUNT(*) AS n FROM problem_companies WHERE company_id = ?", (company_id,)
    ).fetchone()["n"]
    return jsonify({"id": company_id, "name": canonical_name, "problem_count": count}), status


@app.route("/api/companies/<int:company_id>", methods=["DELETE"])
def api_delete_company(company_id):
    db = get_db()
    db.execute("DELETE FROM problem_companies WHERE company_id = ?", (company_id,))
    db.execute("DELETE FROM companies WHERE id = ?", (company_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/problems/<int:problem_id>/companies", methods=["POST"])
def api_tag_problem_company(problem_id):
    data = request.get_json(force=True)
    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO problem_companies (problem_id, company_id) VALUES (?, ?)",
        (problem_id, data["company_id"]),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/problems/<int:problem_id>/companies/<int:company_id>", methods=["DELETE"])
def api_untag_problem_company(problem_id, company_id):
    db = get_db()
    db.execute(
        "DELETE FROM problem_companies WHERE problem_id = ? AND company_id = ?",
        (problem_id, company_id),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/solve/<int:problem_id>", methods=["POST"])
def api_mark_solved(problem_id):
    db = get_db()
    today = today_str()
    next_review = (local_today() + timedelta(days=STAGE_INFO[1]["next_gap"])).isoformat()

    db.execute("""
        INSERT INTO progress (problem_id, status, stage, first_solved_at, next_review_at, last_action_at)
        VALUES (?, 'reviewing', 1, ?, ?, ?)
        ON CONFLICT(problem_id) DO UPDATE SET
            status='reviewing', stage=1, first_solved_at=?, next_review_at=?, last_action_at=?
    """, (problem_id, today, next_review, today, today, next_review, today))
    db.execute(
        "INSERT INTO review_log (problem_id, stage, completed_at, outcome) VALUES (?, 0, ?, 'solved')",
        (problem_id, today),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/review/<int:problem_id>/<action>", methods=["POST"])
def api_complete_review(problem_id, action):
    """action is 'done' (advance to next stage) or 'struggled' (reset to day-1)."""
    db = get_db()
    today = today_str()
    row = db.execute("SELECT * FROM progress WHERE problem_id = ?", (problem_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404

    current_stage = row["stage"]

    db.execute(
        "INSERT INTO review_log (problem_id, stage, completed_at, outcome) VALUES (?, ?, ?, ?)",
        (problem_id, current_stage, today, action),
    )

    if action == "struggled":
        next_review = (local_today() + timedelta(days=STAGE_INFO[1]["next_gap"])).isoformat()
        db.execute("""
            UPDATE progress SET stage = 1, next_review_at = ?, last_action_at = ?, status = 'reviewing'
            WHERE problem_id = ?
        """, (next_review, today, problem_id))
    else:
        next_stage = current_stage + 1
        if next_stage > 3:
            db.execute("""
                UPDATE progress SET status = 'mastered', next_review_at = NULL, last_action_at = ?
                WHERE problem_id = ?
            """, (today, problem_id))
        else:
            gap = STAGE_INFO[next_stage]["next_gap"]
            next_review = (local_today() + timedelta(days=gap)).isoformat()
            db.execute("""
                UPDATE progress SET stage = ?, next_review_at = ?, last_action_at = ?
                WHERE problem_id = ?
            """, (next_stage, next_review, today, problem_id))

    db.commit()
    return jsonify({"ok": True})


@app.route("/api/backfill/candidates")
def api_backfill_candidates():
    db = get_db()
    rows = db.execute("""
        SELECT p.*, pr.status
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE pr.status IS NULL OR pr.status != 'mastered'
        ORDER BY p.order_index ASC
    """).fetchall()
    return jsonify({"problems": [dict(r) for r in rows], "today": today_str()})


@app.route("/api/backfill", methods=["POST"])
def api_backfill():
    data = request.get_json(force=True)
    db = get_db()
    problem_id = int(data["problem_id"])
    completed_date = data["completed_date"]
    completed_stage = str(data["completed_stage"])  # '0','1','2','3'

    db.execute(
        "INSERT INTO review_log (problem_id, stage, completed_at, outcome) VALUES (?, ?, ?, ?)",
        (problem_id, int(completed_stage), completed_date, "backfill"),
    )

    if completed_stage == "3":
        db.execute("""
            INSERT INTO progress (problem_id, status, stage, first_solved_at, next_review_at, last_action_at)
            VALUES (?, 'mastered', 3, ?, NULL, ?)
            ON CONFLICT(problem_id) DO UPDATE SET
                status='mastered', stage=3, first_solved_at=?, next_review_at=NULL, last_action_at=?
        """, (problem_id, completed_date, completed_date, completed_date, completed_date))
    else:
        next_stage = int(completed_stage) + 1
        gap = STAGE_INFO[next_stage]["next_gap"]
        next_review = (date.fromisoformat(completed_date) + timedelta(days=gap)).isoformat()
        db.execute("""
            INSERT INTO progress (problem_id, status, stage, first_solved_at, next_review_at, last_action_at)
            VALUES (?, 'reviewing', ?, ?, ?, ?)
            ON CONFLICT(problem_id) DO UPDATE SET
                status='reviewing', stage=?, first_solved_at=?, next_review_at=?, last_action_at=?
        """, (problem_id, next_stage, completed_date, next_review, completed_date,
              next_stage, completed_date, next_review, completed_date))

    db.commit()
    return jsonify({"ok": True})


@app.route("/api/goal", methods=["GET", "POST"])
def api_goal():
    db = get_db()
    if request.method == "POST":
        data = request.get_json(force=True)
        target_date = data["target_date"]
        date.fromisoformat(target_date)  # validate
        db.execute("""
            INSERT INTO settings (key, value) VALUES ('target_date', ?)
            ON CONFLICT(key) DO UPDATE SET value = ?
        """, (target_date, target_date))
        db.commit()
    return jsonify(get_pacing())


@app.route("/api/settings/timezone", methods=["GET", "POST"])
def api_timezone():
    db = get_db()
    if request.method == "POST":
        data = request.get_json(force=True)
        tz = data["timezone"]
        ZoneInfo(tz)  # raises if not a real IANA name
        db.execute("""
            INSERT INTO settings (key, value) VALUES ('timezone', ?)
            ON CONFLICT(key) DO UPDATE SET value = ?
        """, (tz, tz))
        db.commit()
    return jsonify({"timezone": get_timezone_name(db)})


@app.route("/api/stats")
def api_stats():
    return jsonify({
        "activity": get_activity_by_day(),
        "burndown": get_burndown_series(),
        "difficulty": get_difficulty_breakdown(),
        "streak": get_streak(),
    })


@app.route("/api/digest")
def api_digest():
    rows = digest.get_due_today()
    configured = bool(digest.RESEND_API_KEY and digest.DIGEST_TO)
    return jsonify({
        "rows": [dict(r) for r in rows],
        "configured": configured,
        "to_email": digest.DIGEST_TO,
        "send_time": DIGEST_SEND_TIME,
        "stage_info": STAGE_INFO,
    })


@app.route("/api/digest/send-now", methods=["POST"])
def api_digest_send_now():
    digest.send_daily_digest()
    return jsonify({"ok": True})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and os.path.exists(os.path.join(STATIC_DIST, path)):
        return send_from_directory(STATIC_DIST, path)

    # The built SPA uses relative asset/API paths (Vite `base: "./"`) so a
    # single image works both served at "/" and behind a reverse proxy that
    # mounts it under a stripped path prefix (e.g. nginx `location /1337/`
    # with `proxy_set_header X-Forwarded-Prefix /1337`). Injecting a <base>
    # tag reflecting that prefix is what makes those relative references
    # resolve correctly in either case.
    prefix = request.headers.get("X-Forwarded-Prefix", "").rstrip("/")
    with open(os.path.join(STATIC_DIST, "index.html")) as f:
        html = f.read()
    html = html.replace("<head>", f'<head>\n    <base href="{prefix}/">', 1)
    return html, 200, {"Content-Type": "text/html", "Cache-Control": "no-store"}


def start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    bootstrap_db = sqlite3.connect(DB_PATH)
    bootstrap_db.row_factory = sqlite3.Row
    tz_name = get_timezone_name(bootstrap_db)
    bootstrap_db.close()

    hour, minute = (int(x) for x in DIGEST_SEND_TIME.split(":"))
    scheduler = BackgroundScheduler()
    scheduler.add_job(digest.send_daily_digest, "cron", hour=hour, minute=minute, timezone=ZoneInfo(tz_name))
    scheduler.start()
    print(f"[1337] Daily digest scheduled for {DIGEST_SEND_TIME} ({tz_name}).")


init_db()
start_scheduler()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
