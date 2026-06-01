/**
 * Timezone helpers for the Huckleberry `offset` field.
 *
 * Every tracker entry stores `offset`: the timezone offset in minutes, NEGATED
 * relative to UTC — i.e. UTC+8 (Asia/Singapore) is stored as `-480`, UTC-5
 * (America/New_York, winter) as `+300`. This matches the Python client's
 * `-utcoffset_minutes` convention and was confirmed against live data.
 */

/** Minutes the IANA zone is ahead of UTC at `date` (UTC+8 → +480). */
export function utcOffsetMinutes(timeZone: string, date: Date = new Date()): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The Huckleberry `offset` value for a zone (UTC+8 → -480). */
export function huckleberryOffsetMinutes(timeZone: string, date: Date = new Date()): number {
  const negated = -utcOffsetMinutes(timeZone, date);
  return negated === 0 ? 0 : negated; // normalize -0 → 0
}
