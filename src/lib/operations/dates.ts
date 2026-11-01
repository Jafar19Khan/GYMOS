export function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addCalendarDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(days)) {
    throw new Error("Invalid calendar date or day offset.");
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDateTimeToUtc(value: string, timeZone: string): Date | null {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(targetUtc);

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day ||
    normalized.getUTCHours() !== hour ||
    normalized.getUTCMinutes() !== minute
  ) return null;

  let candidate = targetUtc;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = formatter.formatToParts(new Date(candidate));
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((item) => item.type === type)?.value ?? NaN);
      const displayedAsUtc = Date.UTC(
        part("year"),
        part("month") - 1,
        part("day"),
        part("hour"),
        part("minute"),
      );
      const difference = targetUtc - displayedAsUtc;
      if (difference === 0) return new Date(candidate);
      candidate += difference;
    }
  } catch {
    return null;
  }

  return null;
}
