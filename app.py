import os
import sqlite3
from datetime import date, timedelta
from flask import Flask, g, render_template, request, redirect, url_for

from problems_data import NEETCODE_150
import digest

DB_PATH = "/data/tracker.db"
DIGEST_SEND_TIME = os.environ.get("DIGEST_SEND_TIME", "07:00")

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
    import os
    os.makedirs("/data", exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS problems (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            url TEXT NOT NULL,
            order_index INTEGER NOT NULL
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

    count = db.execute("SELECT COUNT(*) FROM problems").fetchone()[0]
    if count == 0:
        order_index = 0
        for category, problems in NEETCODE_150:
            for name, difficulty, link in problems:
                db.execute(
                    "INSERT INTO problems (name, category, difficulty, url, order_index) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (name, category, difficulty, link, order_index),
                )
                order_index += 1
    db.commit()
    db.close()


def today_str():
    return date.today().isoformat()


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
    mastered = db.execute(
        "SELECT COUNT(*) AS c FROM progress WHERE status = 'mastered'"
    ).fetchone()["c"]
    in_progress = db.execute(
        "SELECT COUNT(*) AS c FROM progress WHERE status = 'reviewing'"
    ).fetchone()["c"]

    categories = db.execute("""
        SELECT p.category,
               COUNT(*) AS total,
               SUM(CASE WHEN pr.status = 'mastered' THEN 1 ELSE 0 END) AS mastered
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        GROUP BY p.category
        ORDER BY MIN(p.order_index)
    """).fetchall()

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
    )


@app.route("/problems")
def problem_list():
    db = get_db()
    rows = db.execute("""
        SELECT p.*, pr.status, pr.stage, pr.next_review_at
        FROM problems p
        LEFT JOIN progress pr ON pr.problem_id = p.id
        ORDER BY p.order_index ASC
    """).fetchall()

    by_category = {}
    for r in rows:
        by_category.setdefault(r["category"], []).append(r)

    return render_template("problems.html", by_category=by_category, stage_info=STAGE_INFO)


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
        # Anki-style lapse: back to stage 1, review again tomorrow.
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
