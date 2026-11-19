export type Granularity = "day" | "week" | "month";
export type Preset = "today" | "7d" | "30d" | "month" | "last_month";
export type SeriesPoint = { bucket: string; sales: number; revenue: number; profit: number };

const TZ = "Africa/Nairobi";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => iso(new Date(utc(s).getTime() + n * 86_400_000));

/** Today's date in the business time zone (Nairobi), as YYYY-MM-DD. */
export const todayInNairobi = (now = new Date()) =>
  now.toLocaleDateString("en-CA", { timeZone: TZ });

export function presetRange(
  preset: Preset,
  today = todayInNairobi(),
): { from: string; to: string } {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: monthStart, to: today };
    case "last_month": {
      const lastEnd = addDays(monthStart, -1);
      return { from: `${lastEnd.slice(0, 8)}01`, to: lastEnd };
    }
  }
}

/** The last n calendar days ending today (Nairobi). */
export const daysRange = (n: number, today = todayInNairobi()) => ({
  from: addDays(today, -(n - 1)),
  to: today,
});

/** Start of the Postgres date_trunc bucket (weeks start on Monday) for a YYYY-MM-DD date. */
export function bucketStart(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "month") return `${date.slice(0, 8)}01`;
  const weekday = (utc(date).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

/** Fills buckets with no sales so charts show real gaps instead of skipping days. */
export function fillSeries(
  rows: SeriesPoint[],
  from: string,
  to: string,
  g: Granularity,
): SeriesPoint[] {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const out: SeriesPoint[] = [];
  let cursor = bucketStart(from, g);
  const last = bucketStart(to, g);
  let guard = 0;
  while (cursor <= last && guard++ < 800) {
    out.push(byBucket.get(cursor) ?? { bucket: cursor, sales: 0, revenue: 0, profit: 0 });
    if (g === "day") cursor = addDays(cursor, 1);
    else if (g === "week") cursor = addDays(cursor, 7);
    else {
      const d = utc(cursor);
      cursor = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
    }
  }
  return out;
}

export const marginPct = (profit: number, revenue: number) =>
  revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

export function bucketLabel(bucket: string, g: Granularity): string {
  const d = utc(bucket);
  if (g === "month")
    return d.toLocaleDateString("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", timeZone: "UTC" });
}
