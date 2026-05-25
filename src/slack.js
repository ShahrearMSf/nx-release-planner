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

function cell(value, width) {
  const str = (value ?? "").toString();
  if (str.length >= width) return str.slice(0, width);
  return str + " ".repeat(width - str.length);
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

  const totalSupport = support?.total ?? 0;
  const resolvedDisplay =
    support?.resolved === null || support?.resolved === undefined
      ? "*"
      : support.resolved.toString();
  const totalDisplay =
    support?.total === null || support?.total === undefined
      ? "*"
      : support.total.toString();

  // Monospaced table — uses code block so columns line up in Slack.
  const header = `${cell("Plugin", 8)} | ${cell("Last Release", 26)} | Releases in window`;
  const sep = `${"-".repeat(8)} | ${"-".repeat(26)} | ${"-".repeat(19)}`;
  const rowFree = `${cell("Free", 8)} | ${cell(lastFree, 26)} | ${freeCount}`;
  const rowPro = `${cell("Pro", 8)} | ${cell(lastPro, 26)} | ${proCount}`;
  const tableBlock = "```" + [header, sep, rowFree, rowPro].join("\n") + "```";

  const supportLine =
    `*Total support in org:* ${totalDisplay}   *Resolved:* ${resolvedDisplay}/${totalDisplay}`;

  const headerText = `Howdy Team! :wave:`;
  const subText =
    `Here's NotificationX development activity for *${win.pretty}* ` +
    `(last 10 days).`;

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
    {
      type: "section",
      text: { type: "mrkdwn", text: tableBlock },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: supportLine },
    },
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
