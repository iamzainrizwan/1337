# 1337

Spaced-repetition tracker for the NeetCode 150, self-hosted on alexandria. Solve a problem, then get nudged to review it at day 1, week 1, and week 3 — with a daily email telling you what's due.

## How the review cycle works

Each problem moves through 4 stages:

1. **Solve** — mark it solved the day you first do it.
2. **+1 day** — review it again tomorrow.
3. **+1 week** — review again 7 days after that.
4. **+3 weeks** — review again 21 days after that. Complete this and it's "mastered".

If a review doesn't come back to you, hit **Struggled** instead of **Solved it** — that resets it to a next-day review instead of advancing it, so weak problems get more reps.

Every gap is calculated from the day you actually complete the review, not the original due date — so if you're late, later reviews shift out from there instead of piling up (same idea as Anki's rescheduling).

## Pages

- **Dashboard** — what's due today, what's coming up, and progress per category.
- **Problems** — the full NeetCode 150 in roadmap order, grouped by category, with "mark solved" buttons.
- **Digest** — today's due list plus a "send this email now" button for testing your Resend setup.

## Daily email digest

Sends a short email every morning listing whatever's due that day (or a "nothing due" note if the queue's empty), via [Resend](https://resend.com). This runs as an in-process scheduled job — no separate cron container needed, so `docker compose up` is the whole deploy.

### Setup

1. Grab an API key from [resend.com](https://resend.com/api-keys).
2. Copy the env file and fill it in:

   ```bash
   cp .env.example .env
   ```

   ```
   RESEND_API_KEY=re_your_key_here
   DIGEST_TO_EMAIL=you@example.com
   DIGEST_FROM_EMAIL=onboarding@resend.dev
   DIGEST_SEND_TIME=07:00
   TZ=Europe/London
   ```

   `onboarding@resend.dev` works with no domain verification, but Resend will only let that sender deliver to the email address you signed up with. Once you verify your own domain in Resend, switch `DIGEST_FROM_EMAIL` to something like `1337@yourdomain.com` to send to any address.

3. `DIGEST_SEND_TIME` is 24-hour local time, evaluated against the `TZ` you set (defaults to `Europe/London`).

4. Test it without waiting for the schedule: open the **Digest** tab in the app and hit **Send this email now**.

If `RESEND_API_KEY` or `DIGEST_TO_EMAIL` isn't set, the app just skips sending and logs a note — everything else still works.

## Running it

```bash
docker compose up -d --build
```

The app listens on port 5150 by default (mapped in `docker-compose.yml`). Data lives in `./data/tracker.db`, so back that folder up if you care about progress history.

Note: the container runs gunicorn with a single worker on purpose — the digest scheduler lives in-process, and a second worker would mean a second scheduler and duplicate emails. Fine for a single-user LAN app; if you ever need more concurrency, move the scheduler to a separate cron trigger hitting `POST /digest/send-now` instead.

## Wiring into your existing Nginx setup

Same pattern as the rest of the arr stack — add a location block proxying to `127.0.0.1:5150`:

```nginx
location /1337/ {
    proxy_pass http://127.0.0.1:5150/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Or give it its own subdomain (`1337.alexandria.local`) if you'd rather keep it off the shared dashboard path.

## Notes

- The NeetCode 150 list is seeded on first run, in NeetCode's roadmap order, grouped by category.
- No auth — this assumes it only sits on your LAN/Tailscale like the rest of the stack. Add basic auth in Nginx if you ever expose it further.
