// Entry point. Computes the current 10-day window, runs the three scrapers
// in parallel, builds the Slack payload, and either prints it (DRY_RUN=1 or
// missing webhook) or POSTs to SLACK_WEBHOOK_URL.

import { computeWindow } from "./window.js";
import { scrapeFree } from "./scrapeFree.js";
import { scrapePro } from "./scrapePro.js";
import { scrapeSupport } from "./scrapeSupport.js";
import { buildPayload, postToSlack } from "./slack.js";

function log(msg, extra) {
  if (extra !== undefined) {
    console.log(`[nx-release-planner] ${msg}`, extra);
  } else {
    console.log(`[nx-release-planner] ${msg}`);
  }
}

async function safe(label, fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    log(`${label} failed: ${err.message}`);
    return { ok: false, error: err };
  }
}

async function main() {
  const now = process.env.RUN_DATE
    ? new Date(process.env.RUN_DATE)
    : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid RUN_DATE: ${process.env.RUN_DATE}`);
  }

  const win = computeWindow(now);
  log(`Window: ${win.pretty} (${win.start.toISOString()} → ${win.end.toISOString()})`);

  const [freeR, proR, supportR] = await Promise.all([
    safe("scrapeFree", () => scrapeFree(win)),
    safe("scrapePro", () => scrapePro(win)),
    safe("scrapeSupport", () => scrapeSupport(win)),
  ]);

  const free = freeR.ok ? freeR.value : null;
  const pro = proR.ok ? proR.value : null;
  const support = supportR.ok ? supportR.value : null;

  log("Free:", free);
  log("Pro:", pro);
  log("Support:", support);

  if (pro?.degraded) {
    log("WARN: Pro changelog parser fell back to whole-page scan (Pro section not found).");
  }

  const payload = buildPayload({ window: win, free, pro, support });

  const webhook = process.env.SLACK_WEBHOOK_URL;
  const dryRun = process.env.DRY_RUN === "1" || !webhook;

  if (dryRun) {
    log(webhook ? "DRY_RUN=1 — not posting." : "No SLACK_WEBHOOK_URL — not posting.");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  log("Posting to Slack…");
  await postToSlack(webhook, payload);
  log("Posted.");

  // Hard-fail if any scraper failed, so the GitHub Action run is red.
  const failures = [freeR, proR, supportR].filter((r) => !r.ok);
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} scraper(s) failed — message posted with partial data. ` +
        `See logs above.`
    );
  }
}

main().catch((err) => {
  console.error(`[nx-release-planner] FATAL: ${err.stack || err.message}`);
  process.exit(1);
});
