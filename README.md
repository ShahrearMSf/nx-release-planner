# nx-release-planner

Posts a Slack digest of NotificationX development activity every 10 days.

The script runs in GitHub Actions at 09:00 Asia/Dhaka (03:00 UTC) on the
10th, 20th, and last day of each month (28 for February). For each run it
scrapes:

| Source | What we read |
| --- | --- |
| [WP.org plugin page](https://wordpress.org/plugins/notificationx/) | Free changelog → last release + count of releases inside the current 10-day window |
| [notificationx.com/changelog](https://notificationx.com/changelog/) | Pro section only → last release + count inside the window |
| [WP.org support forum](https://wordpress.org/support/plugin/notificationx/) | Topics with activity inside the window + how many are marked Resolved |

The "window" is whichever calendar third of the month the run lands in
(01–10, 11–20, or 21–end).

## Slack message shape

A header, a monospaced table, the support line, and two CTA buttons:

```
NotificationX — May 11–20, 2026

Howdy Team! 👋
Here's NotificationX development activity for May 11–20, 2026 (last 10 days).

Plugin   | Last Release               | Releases in window
-------- | -------------------------- | -------------------
Free     | May 20, 2026 (v3.2.7)      | 1
Pro      | May 18, 2026 (v3.2.6)      | 2

Total support in org: 7   Resolved: 4/7

[ Learn More — Free ]  [ Learn More — Pro ]
```

If the support scraper can't detect resolved status (page markup changed),
the resolved number is replaced with `*` per spec.

## Setup

1. Create the repo on GitHub and push this folder as the repo root.
2. **Settings → Secrets and variables → Actions:**
   - **Secret** `SLACK_WEBHOOK_URL` — your channel's incoming webhook URL.
   - **Variables (optional)** — override the URLs the scrapers + buttons
     use: `FREE_PLUGIN_URL`, `PRO_CHANGELOG_URL`, `PRO_SITE_URL`,
     `SUPPORT_FORUM_URL`. Leave unset to use the defaults baked into
     `src/config.js`.
3. The cron schedule starts firing automatically. To trigger manually, use
   the **Actions** tab → "NX Release Digest" → "Run workflow".

The manual run form supports:
- `dry_run = true` — prints the payload, doesn't post.
- `run_date = 2026-05-20` — pretend today is this date (useful for testing
  a specific window).

## Local development

```bash
npm install
npx playwright install --with-deps chromium

# Optional: copy the env template and edit values:
cp .env.example .env

# Dry run (prints payload):
npm run dry-run

# Real run (needs SLACK_WEBHOOK_URL in .env or shell):
npm start

# Pretend it's a specific day (overrides .env):
RUN_DATE=2026-02-28 npm run dry-run
```

The scripts use Node's built-in `--env-file-if-exists=.env` flag, so the
`.env` file is loaded automatically when present and skipped when absent
(e.g. in CI, where variables come from the workflow `env:` block).

## File map

- `src/window.js` — computes the 10-day window from the run date.
- `src/scrapeFree.js` — WP.org plugin page → Free releases.
- `src/scrapePro.js` — notificationx.com → Pro releases.
- `src/scrapeSupport.js` — WP.org support forum.
- `src/slack.js` — Block Kit payload builder + webhook POST.
- `src/index.js` — orchestrator.
- `.github/workflows/digest.yml` — cron + manual trigger.

## When scrapers break

The scrapers parse free-form text (changelog headings, relative-time
strings, bbPress row classes). If WP.org or notificationx.com restructure
their pages, expect breakage. Each scraper throws a descriptive error
naming the page and what it couldn't find — the orchestrator still posts
the partial digest and then exits non-zero so the Action goes red.

To debug locally, add `await page.screenshot({ path: 'debug-X.png' })`
inside the failing scraper and re-run with `npm run dry-run`.

## Author

**Muammar Shahrear** is a software tester and researcher specializing in
test automation, AI agents, WordPress plugin testing, and SaaS product
quality assurance. He completed his B.Sc. and M.Sc. from the Institute of
Information Technology (IIT), Jahangirnagar University (JU), Bangladesh,
and also holds an M.Sc. from Technische Hochschule Mittelhessen (THM),
Germany.

- [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/muammarshahrear/)
- [![Google Scholar](https://img.shields.io/badge/Google_Scholar-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white)](https://scholar.google.com/citations?user=nPKujs4AAAAJ)

**Contact:**
- LinkedIn: [@Muammar Shahrear](https://www.linkedin.com/in/muammarshahrear/)
- Email: [shahrearmuammar@gmail.com](mailto:shahrearmuammar@gmail.com)
