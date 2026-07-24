import math
import os
import sqlite3
from datetime import date, timedelta
from flask import Flask, g, render_template, request, redirect, url_for

from problems_data import NEETCODE_250, CORE_150_URLS
import digest

DB_PATH = "/data/tracker.db"
DIGEST_SEND_TIME = os.environ.get("DIGEST_SEND_TIME", "07:00")

# How many days after a review is completed the pipeline is fully "drained" --
# i.e. the gap between solving a problem and its final 3-week review.
REVIEW_TAIL_DAYS = 1 + 7 + 21  # day-1 + week-1 + 3-week gaps, cumulative from solve

GOAL_TARGET_DAYS = int(os.environ.get("GOAL_TARGET_DAYS", "60"))  # 2 months default

# stage -> (label, days until next review after completing this stage)
STAGE_INFO = {
    0: {"label": "Not started", "next_gap": None},
    1: {"label": "Day 1 review",  "next_gap": 1},   # gap to reach stage 1
    2: {"label": "Week 1 review", "next_gap": 7},   # gap to reach stage 2
    3: {"label": "3 Week review", "next_gap": 21},  # gap to reach stage 3
}

app = Flask(__name__)


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
    # add `pool` column for installs created before it existed
    cols = [r[1] for r in db.execute("PRAGMA table_info(problems)").fetchall()]
    if "pool" not in cols:
        db.execute("ALTER TABLE problems ADD COLUMN pool TEXT NOT NULL DEFAULT 'core'")

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

    # Goal start date: set once, on first ever run, and never touched again.
    if db.execute("SELECT 1 FROM settings WHERE key = 'goal_start_date'").fetchone() is None:
        db.execute("INSERT INTO settings (key, value) VALUES ('goal_start_date', ?)", (today_str(),))

    db.commit()
    db.close()


def today_str():
    return date.today().isoformat()


def get_setting(db, key, default=None):
    row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def get_pacing():
    """Goal math for the core (NeetCode 150) set, factoring in the 21-day
    review tail so the suggested pace actually finishes reviews in time,
    not just new-problem starts."""
    db = get_db()
    start_date = date.fromisoformat(get_setting(db, "goal_start_date", today_str()))
    target_days = GOAL_TARGET_DAYS
    target_count = db.execute("SELECT COUNT(*) FROM problems WHERE pool = 'core'").fetchone()[0]

    # Last day new problems should be started so the final 3-week review
    # still lands inside the target window.
    effective_days = max(target_days - REVIEW_TAIL_DAYS, 1)
    required_rate = target_count / effective_days

    days_elapsed = (date.today() - start_date).days  # 0 on day 1
    in_new_problem_window = days_elapsed < effective_days

    expected_started_by_today = min(round(required_rate * (days_elapsed + 1)), target_count)

    actual_started = db.execute("""
        SELECT COUNT(*) FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core' AND pr.status != 'not_started'
    """).fetchone()[0]

    actual_mastered = db.execute("""
        SELECT COUNT(*) FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE p.pool = 'core' AND pr.status = 'mastered'
    """).fetchone()[0]

    pace_delta = actual_started - expected_started_by_today
    suggested_new_count = max(expected_started_by_today - actual_started, 0)
    if not in_new_problem_window:
        suggested_new_count = 0
    remaining_unstarted = max(target_count - actual_started, 0)
    suggested_new_count = min(suggested_new_count, remaining_unstarted, 8)

    deadline = start_date + timedelta(days=target_days)
    new_problem_deadline = start_date + timedelta(days=effective_days)

    return {
        "start_date": start_date,
        "deadline": deadline,
        "new_problem_deadline": new_problem_deadline,
        "target_days": target_days,
        "target_count": target_count,
        "days_elapsed": days_elapsed,
        "required_rate": required_rate,
        "actual_started": actual_started,
        "actual_mastered": actual_mastered,
        "pace_delta": pace_delta,
        "suggested_new_count": suggested_new_count,
        "in_new_problem_window": in_new_problem_window,
        "remaining_unstarted": remaining_unstarted,
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


@app.route("/")
def dashboard():
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
               SUM(CASE WHEN pr.status = 'mastered' THEN 1 ELSE 0 END) AS mastered
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE p.pool = 'core'
        GROUP BY p.category
        ORDER BY MIN(p.order_index)
    """).fetchall()

    pacing = get_pacing()
    suggested = get_suggested_new_problems(pacing["suggested_new_count"])

    return render_template(
        "dashboard.html",
        due=due,
        upcoming=upcoming,
        totals=totals,
        mastered=mastered,
        in_progress=in_progress,
        categories=categories,
        stage_info=STAGE_INFO,
        today=today,
        pacing=pacing,
        suggested=suggested,
    )


@app.route("/problems")
def problem_list():
    db = get_db()
    pool_filter = request.args.get("pool", "core")
    rows = db.execute("""
        SELECT p.*, pr.status, pr.stage, pr.next_review_at
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE (? = 'all' OR p.pool = ?)
        ORDER BY p.order_index ASC
    """, (pool_filter, pool_filter)).fetchall()

    by_category = {}
    for r in rows:
        by_category.setdefault(r["category"], []).append(r)

    return render_template(
        "problems.html", by_category=by_category, stage_info=STAGE_INFO, pool_filter=pool_filter
    )


@app.route("/solve/<int:problem_id>", methods=["POST"])
def mark_solved(problem_id):
    db = get_db()
    today = today_str()
    next_review = (date.today() + timedelta(days=STAGE_INFO[1]["next_gap"])).isoformat()

    db.execute("""
        INSERT INTO progress (problem_id, status, stage, first_solved_at, next_review_at, last_action_at)
        VALUES (?, 'reviewing', 1, ?, ?, ?)
        ON CONFLICT(problem_id) DO UPDATE SET
            status='reviewing', stage=1, first_solved_at=?, next_review_at=?, last_action_at=?
    """, (problem_id, today, next_review, today, today, next_review, today))
    db.commit()

    return redirect(request.referrer or url_for("dashboard"))


@app.route("/review/<int:problem_id>/<action>", methods=["POST"])
def complete_review(problem_id, action):
    """action is 'done' (advance to next stage) or 'struggled' (reset to day-1)."""
    db = get_db()
    today = today_str()
    row = db.execute("SELECT * FROM progress WHERE problem_id = ?", (problem_id,)).fetchone()
    if row is None:
        return redirect(request.referrer or url_for("dashboard"))

    current_stage = row["stage"]

    db.execute(
        "INSERT INTO review_log (problem_id, stage, completed_at, outcome) VALUES (?, ?, ?, ?)",
        (problem_id, current_stage, today, action),
    )

    if action == "struggled":
        next_review = (date.today() + timedelta(days=STAGE_INFO[1]["next_gap"])).isoformat()
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
            next_review = (date.today() + timedelta(days=gap)).isoformat()
            db.execute("""
                UPDATE progress SET stage = ?, next_review_at = ?, last_action_at = ?
                WHERE problem_id = ?
            """, (next_stage, next_review, today, problem_id))

    db.commit()
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/backfill", methods=["GET", "POST"])
def backfill():
    db = get_db()

    if request.method == "POST":
        problem_id = int(request.form["problem_id"])
        completed_date = request.form["completed_date"]
        completed_stage = request.form["completed_stage"]  # '0','1','2','3'

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
        return redirect(url_for("backfill", done=1))

    rows = db.execute("""
        SELECT p.*, pr.status
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        WHERE pr.status IS NULL OR pr.status != 'mastered'
        ORDER BY p.order_index ASC
    """).fetchall()

    by_category = {}
    for r in rows:
        by_category.setdefault(r["category"], []).append(r)

    return render_template("backfill.html", by_category=by_category, today=today_str())


@app.route("/digest")
def digest_tab():
    rows = digest.get_due_today()
    configured = bool(digest.RESEND_API_KEY and digest.DIGEST_TO)
    return render_template(
        "digest.html",
        rows=rows,
        configured=configured,
        to_email=digest.DIGEST_TO,
        send_time=DIGEST_SEND_TIME,
        stage_info=STAGE_INFO,
    )


@app.route("/digest/send-now", methods=["POST"])
def digest_send_now():
    digest.send_daily_digest()
    return redirect(url_for("digest_tab"))


def start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    hour, minute = (int(x) for x in DIGEST_SEND_TIME.split(":"))
    scheduler = BackgroundScheduler()
    scheduler.add_job(digest.send_daily_digest, "cron", hour=hour, minute=minute)
    scheduler.start()
    print(f"[1337] Daily digest scheduled for {DIGEST_SEND_TIME}.")


init_db()
start_scheduler()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
