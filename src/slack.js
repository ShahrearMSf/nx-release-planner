// Build the Slack Block Kit payload for the NotificationX 10-day digest,
// and POST it to an Incoming Webhook URL.
//
// The webhook accepts the standard `blocks` array plus a fallback `text`
// (used by clients that don't render blocks, e.g. mobile push previews).

import { FREE_PLUGIN_URL as FREE_URL, PRO_SITE_URL as PRO_URL } from "./config.js";

function fmtDate(d) {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildPayload({ window: win, free, pro, support }) {
  const lastFree = free?.lastRelease
    ? `${fmtDate(free.lastRelease.date)} (v${free.lastRelease.version})`
    : "—";
  const lastPro = pro?.lastRelease
    ? `${fmtDate(pro.lastRelease.date)} (v${pro.lastRelease.version})`
    : "—";

  const freeCount = free?.total ?? 0;
  const proCount = pro?.total ?? 0;

  const resolvedDisplay =
    support?.resolved === null || support?.resolved === undefined
      ? "*"
      : support.resolved.toString();
  const totalDisplay =
    support?.total === null || support?.total === undefined
      ? "*"
      : support.total.toString();

  // We deliberately avoid a monospaced code block here because Slack does
  // not soft-wrap inside ``` fences — wide tables stay one long line on
  // mobile and either clip or scroll horizontally. Instead we use one
  // section per plugin with bold labels + bullets, which stacks naturally
  // on mobile while still reading as a clean table on desktop.

  const headerText = `Howdy Team! :wave:`;
  const subText =
    `Here's NotificationX development activity for *${win.pretty}* ` +
    `(last 10 days).`;

  const freePluginBlock =
    `:large_green_circle:  *Free Plugin*\n` +
    `• Last release: *${lastFree}*\n` +
    `• Releases in window: *${freeCount}*`;

  const proPluginBlock =
    `:large_purple_circle:  *Pro Plugin*\n` +
    `• Last release: *${lastPro}*\n` +
    `• Releases in window: *${proCount}*`;

  const supportBlock =
    `:speech_balloon:  *Support (org.wordpress.org)*\n` +
    `• Total in window: *${totalDisplay}*\n` +
    `• Resolved: *${resolvedDisplay}/${totalDisplay}*`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `NotificationX — ${win.pretty}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${headerText}*\n${subText}`,
      },
    },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: freePluginBlock } },
    { type: "section", text: { type: "mrkdwn", text: proPluginBlock } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: supportBlock } },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Learn More — Free", emoji: true },
          url: FREE_URL,
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Learn More — Pro", emoji: true },
          url: PRO_URL,
        },
      ],
    },
  ];

  const fallbackText =
    `NotificationX ${win.pretty} — Free: ${freeCount} releases (last ${lastFree}), ` +
    `Pro: ${proCount} releases (last ${lastPro}). ` +
    `Support: ${resolvedDisplay}/${totalDisplay} resolved.`;

  return { text: fallbackText, blocks };
}

export async function postToSlack(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok || body !== "ok") {
    throw new Error(
      `Slack webhook failed: HTTP ${res.status} — ${body.slice(0, 500)}`
    );
  }
  return body;
}
