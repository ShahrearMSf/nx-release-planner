// Scrape the NotificationX changelog from the WP.org plugin page.
// Format observed: <h4>3.2.7 – 20/05/2026</h4> (DD/MM/YYYY, en-dash separator)
//
// Returns { lastRelease: {version, date} | null, releases: [{version, date}], total }

import { chromium } from "playwright";
import { withinWindow } from "./window.js";
import { FREE_PLUGIN_URL as URL } from "./config.js";

// Parse strings like "3.2.7 – 20/05/2026" or "3.2.7 - 20/05/2026"
// Tolerates en-dash (–), em-dash (—), and hyphen (-), plus extra whitespace.
function parseHeading(text) {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  const m = cleaned.match(
    /^(\d+(?:\.\d+){1,3})\s*[–—\-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );
  if (!m) return null;
  const [, version, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  if (Number.isNaN(date.getTime())) return null;
  return { version, date };
}

export async function scrapeFree(win) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; nx-release-planner/1.0; +internal)",
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const headings = await page.$$eval(
      "h4, h3",
      (els) => els.map((el) => el.textContent || "")
    );

    const releases = headings
      .map(parseHeading)
      .filter((x) => x !== null);

    if (releases.length === 0) {
      throw new Error(
        "No changelog entries parsed from WP.org plugin page. Selector or readme format may have changed."
      );
    }

    // Most recent first (already so per readme, but sort defensively)
    releases.sort((a, b) => b.date - a.date);

    const inWindow = releases.filter((r) => withinWindow(r.date, win));

    return {
      lastRelease: releases[0],
      releases: inWindow,
      total: inWindow.length,
    };
  } finally {
    await browser.close();
  }
}
