// Scrape the WP.org support forum for NotificationX.
//
// The listing is ordered by last-activity (freshness), not by creation date,
// and creation date is not shown on the list view. We approximate "support
// activity in the window" as "topics whose last post falls inside the window."
//
// Resolved detection uses the bbPress row class (`status-resolved`) when
// present; otherwise we look at the topic row's visible status icon/text.
//
// Returns { total, resolved }. If we can't determine resolved, resolved=null.

import { chromium } from "playwright";
import { SUPPORT_FORUM_URL as URL } from "./config.js";

// Convert relative time strings like "2 months, 1 week ago", "3 days ago",
// "5 hours ago", "1 year ago" into an approximate Date (UTC) using `now`
// as the reference. Returns null on parse failure.
function parseRelative(text, now = new Date()) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/just now|moments ago/.test(t)) return new Date(now);

  // Sum every "<number> <unit>" we find.
  const re =
    /(\d+)\s*(year|month|week|day|hour|minute|second)s?/g;
  let ms = 0;
  let matched = false;
  let m;
  while ((m = re.exec(t)) !== null) {
    matched = true;
    const n = +m[1];
    const unit = m[2];
    switch (unit) {
      case "year":   ms += n * 365 * 24 * 3600 * 1000; break;
      case "month":  ms += n * 30 * 24 * 3600 * 1000; break;
      case "week":   ms += n * 7 * 24 * 3600 * 1000; break;
      case "day":    ms += n * 24 * 3600 * 1000; break;
      case "hour":   ms += n * 3600 * 1000; break;
      case "minute": ms += n * 60 * 1000; break;
      case "second": ms += n * 1000; break;
    }
  }
  if (!matched) return null;
  return new Date(now.getTime() - ms);
}

export async function scrapeSupport(win) {
  const now = new Date();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; nx-release-planner/1.0; +internal)",
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const rows = await page.$$eval(
      "li.bbp-body-topic, ul#bbp-forum-0 > li, ul.bbp-topics > li, li.topic",
      (els) =>
        els.map((el) => ({
          className: el.className || "",
          html: el.outerHTML.slice(0, 4000),
          text: (el.innerText || el.textContent || "").trim(),
        }))
    );

    // Fallback: if the bbPress selectors miss, grab anything in the topic list.
    let candidates = rows;
    if (candidates.length === 0) {
      candidates = await page.$$eval("li", (els) =>
        els
          .filter((el) => {
            const txt = (el.innerText || "").toLowerCase();
            return txt.includes("started by") && /ago/.test(txt);
          })
          .map((el) => ({
            className: el.className || "",
            html: el.outerHTML.slice(0, 4000),
            text: (el.innerText || el.textContent || "").trim(),
          }))
      );
    }

    let total = 0;
    let resolved = 0;
    let resolvedDetected = false;

    for (const row of candidates) {
      // Pull the "X ago" freshness text — last occurrence in row text.
      const agoMatches = [...row.text.matchAll(/[\d\w,\s]+ago/g)];
      const lastAgo = agoMatches.length
        ? agoMatches[agoMatches.length - 1][0]
        : null;
      const lastActivity = parseRelative(lastAgo, now);
      if (!lastActivity) continue;

      // Approximate: if last activity within window, count this row.
      if (lastActivity < win.start || lastActivity > win.end) continue;
      total += 1;

      const cls = row.className.toLowerCase();
      const html = row.html.toLowerCase();
      if (cls.includes("status-resolved") || cls.includes(" resolved")) {
        resolvedDetected = true;
        resolved += 1;
      } else if (
        html.includes("status-resolved") ||
        html.includes('class="resolved"') ||
        html.includes("title=\"resolved\"")
      ) {
        resolvedDetected = true;
        resolved += 1;
      }
    }

    return {
      total,
      resolved: resolvedDetected || total === 0 ? resolved : null,
    };
  } finally {
    await browser.close();
  }
}
