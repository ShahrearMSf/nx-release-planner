// Centralized URL config. All four URLs can be overridden via env vars;
// the defaults match the production NotificationX pages.

export const FREE_PLUGIN_URL =
  process.env.FREE_PLUGIN_URL || "https://wordpress.org/plugins/notificationx/";

export const PRO_CHANGELOG_URL =
  process.env.PRO_CHANGELOG_URL || "https://notificationx.com/changelog/";

export const PRO_SITE_URL =
  process.env.PRO_SITE_URL || "https://notificationx.com/";

export const SUPPORT_FORUM_URL =
  process.env.SUPPORT_FORUM_URL ||
  "https://wordpress.org/support/plugin/notificationx/";
