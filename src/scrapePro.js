// Scrape the NotificationX Pro changelog from notificationx.com/changelog.
// The page has two sections — "NotificationX Changelog" (Free) and
// "NotificationX Pro Changelog". We only count entries within the Pro section.
//
// Observed entry format: "Apr 19, 2026 v3.2.6" (Mon DD, YYYY then version)
//
// Returns { lastRelease: {version, date} | null, releases: [...], total }

import { chromium } from "playwright";
import { withinWindow } from "./window.js";
import { PRO_CHANGELOG_URL as URL } from "./config.js";

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseEntry(text) {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  // "Apr 19, 2026 v3.2.6" or "Apr 19, 2026 - v3.2.6" or with extra punctuation
  const m = cleaned.match(
    /([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})[\s\-–—]*v?(\d+(?:\.\d+){1,3})/
  );
  if (!m) return null;
  const [, monStr, dd, yyyy, version] = m;
  const month = MONTHS[monStr.slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(+yyyy, month, +dd));
  if (Number.isNaN(date.getTime())) return null;
  return { version, date };
}

export async function scrapePro(win) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; nx-release-planner/1.0; +internal)",
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Strategy: pull every visible block of text on the page in DOM order,
    // find the "Pro" section heading, then parse entries that follow until the
    // next major section heading.
    const blocks = await page.$$eval(
      "h1, h2, h3, h4, h5, p, li, div",
      (els) =>
        els
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.textContent || "").trim(),
          }))
          .filter((b) => b.text.length > 0 && b.text.length < 400)
    );

    let inPro = false;
    const seenKeys = new Set();
    const releases = [];

    for (const b of blocks) {
      const lower = b.text.toLowerCase();
      const isHeading = /^h[1-5]$/.test(b.tag);

      if (isHeading && /\bpro\b.*changelog|changelog.*\bpro\b/.test(lower)) {
        inPro = true;
        continue;
      }
      // A "Free / Lite / NotificationX Changelog" heading ends the Pro window
      // — but only if we already entered Pro.
      if (
        inPro &&
        isHeading &&
        /changelog/.test(lower) &&
        !/\bpro\b/.test(lower)
      ) {
        break;
      }
      if (!inPro) continue;

      const parsed = parseEntry(b.text);
      if (!parsed) continue;
      const key = `${parsed.version}|${parsed.date.toISOString()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      releases.push(parsed);
    }

    // Fallback: if we never saw a "Pro" heading (page restructured),
    // scan the whole page and trust whatever we parse. Better stale data
    // than no data — the orchestrator will log a warning.
    let degraded = false;
    if (!inPro || releases.length === 0) {
      degraded = true;
      for (const b of blocks) {
        const parsed = parseEntry(b.text);
        if (!parsed) continue;
        const key = `${parsed.version}|${parsed.date.toISOString()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        releases.push(parsed);
      }
    }

    if (releases.length === 0) {
      throw new Error(
        "No Pro changelog entries parsed from notificationx.com/changelog. Page structure may have changed."
      );
    }

    releases.sort((a, b) => b.date - a.date);
    const inWindow = releases.filter((r) => withinWindow(r.date, win));

    return {
      lastRelease: releases[0],
      releases: inWindow,
      total: inWindow.length,
      degraded,
    };
  } finally {
    await browser.close();
  }
}
