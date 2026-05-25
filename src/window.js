// Compute the current 10-day window based on the run date.
// Windows are calendar thirds of the month:
//   day 01-10  → window "01-10"
//   day 11-20  → window "11-20"
//   day 21-end → window "21-end"
// The cron only fires on day 10, 20, and the last day of the month
// (28 for February even in leap years), but the logic also handles
// off-cycle manual runs by choosing whichever third today falls in.

export function computeWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const day = now.getUTCDate();

  // Last day of this month — use Feb 28 even in leap years.
  const lastDay =
    month === 1 ? 28 : new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  let startDay;
  let endDay;
  let label;

  if (day <= 10) {
    startDay = 1;
    endDay = 10;
    label = "01–10";
  } else if (day <= 20) {
    startDay = 11;
    endDay = 20;
    label = "11–20";
  } else {
    startDay = 21;
    endDay = lastDay;
    label = `21–${lastDay}`;
  }

  const start = new Date(Date.UTC(year, month, startDay, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, endDay, 23, 59, 59));

  const monthName = start.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return {
    start,
    end,
    label,
    monthName,
    year,
    pretty: `${monthName} ${label}, ${year}`,
  };
}

export function withinWindow(date, win) {
  if (!date) return false;
  return date >= win.start && date <= win.end;
}
