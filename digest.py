import os
import sqlite3
from datetime import date

import resend

DB_PATH = "/data/tracker.db"

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
DIGEST_TO = os.environ.get("DIGEST_TO_EMAIL")
DIGEST_FROM = os.environ.get("DIGEST_FROM_EMAIL", "onboarding@resend.dev")

STAGE_LABELS = {1: "Day 1 review", 2: "Week 1 review", 3: "3 Week review"}


def get_due_today():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    today = date.today().isoformat()
    rows = db.execute("""
        SELECT p.name, p.category, p.difficulty, p.url, pr.stage, pr.next_review_at
        FROM progress pr JOIN problems p ON p.id = pr.problem_id
        WHERE pr.status = 'reviewing' AND pr.next_review_at <= ?
        ORDER BY pr.next_review_at ASC
    """, (today,)).fetchall()
    db.close()
    return rows


def render_email_html(rows):
    if not rows:
        return """
        <div style="font-family: 'SF Mono', Consolas, monospace; background:#000000; color:#e0e0e0; padding:24px;">
            <h2 style="color:#ff4444; margin-top:0;">1337</h2>
            <p>Nothing due today. Clean slate — go start a new problem.</p>
        </div>
        """

    items = ""
    for r in rows:
        items += f"""
        <tr>
            <td style="padding:8px 0; border-bottom:1px solid #222222;">
                <a href="{r['url']}" style="color:#5a9fd4; text-decoration:none;">{r['name']}</a><br>
                <span style="color:#666666; font-size:12px;">{r['category']} · {STAGE_LABELS.get(r['stage'], '')}</span>
            </td>
        </tr>
        """

    return f"""
    <div style="font-family: 'SF Mono', Consolas, monospace; background:#000000; color:#e0e0e0; padding:24px;">
        <h2 style="color:#ff4444; margin-top:0;">1337 — {len(rows)} due today</h2>
        <table style="width:100%; border-collapse:collapse;">
            {items}
        </table>
    </div>
    """


def send_daily_digest():
    if not RESEND_API_KEY or not DIGEST_TO:
        print("[1337] Skipping digest send: RESEND_API_KEY or DIGEST_TO_EMAIL not set.")
        return

    rows = get_due_today()
    resend.api_key = RESEND_API_KEY

    resend.Emails.send({
        "from": DIGEST_FROM,
        "to": DIGEST_TO,
        "subject": f"1337 — {len(rows)} due today" if rows else "1337 — nothing due today",
        "html": render_email_html(rows),
    })
    print(f"[1337] Digest sent to {DIGEST_TO} ({len(rows)} problems due).")
