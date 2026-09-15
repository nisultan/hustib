/**
 * All dates in this app are plain "YYYY-MM-DD" strings interpreted in the
 * user's local timezone. Parsing with `new Date(iso)` would treat them as UTC
 * and shift the day, so every conversion goes through these helpers.
 */

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole days from today to `iso`. Negative means overdue. */
export function daysUntil(iso: string): number {
  const a = fromISO(todayISO()).getTime();
  const b = fromISO(iso).getTime();
  return Math.round((b - a) / 86400000);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Sep 18", or "Sep 18, 2026" when the year differs from today's. */
export function formatDate(iso: string): string {
  const d = fromISO(iso);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const thisYear = new Date().getFullYear();
  return d.getFullYear() === thisYear ? base : `${base}, ${d.getFullYear()}`;
}

/** Human-facing relative label: "Today", "Tomorrow", "3 days overdue", "Sep 18". */
export function relativeLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${Math.abs(n)} days overdue`;
  if (n < 7) return `In ${n} days`;
  return formatDate(iso);
}

/**
 * How far away a date is, in words, for use *alongside* the date itself.
 * `relativeLabel` falls back to printing the date once it is more than a week
 * out, which would read as "Jan 5, 2027 (Jan 5, 2027)" next to a date; this
 * always returns a duration instead.
 */
export function countdownLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) {
    const overdue = Math.abs(n);
    return overdue < 30 ? `${overdue} days overdue` : "long overdue";
  }
  if (n < 30) return `in ${n} days`;
  const months = Math.round(n / 30);
  return months === 1 ? "in about a month" : `in about ${months} months`;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${`${m}`.padStart(2, "0")} ${suffix}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
