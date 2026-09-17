/** Date helpers. Day keys use the player's local time zone: "YYYY-MM-DD". */

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** @param {number|Date} time */
export function dayKey(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days from dayKey `from` to dayKey `to` (can be negative). */
export function daysBetween(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** Day keys for the `count` days ending with `time` (oldest first). */
export function recentDayKeys(time, count) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(time).setHours(12, 0, 0, 0) - i * DAY_MS));
  }
  return keys;
}

/** ISO-8601 week key such as "2026-W38". */
export function isoWeekKey(time) {
  const date = new Date(time);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / DAY_MS + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
