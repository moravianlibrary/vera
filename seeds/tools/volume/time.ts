import { type Random, weighted } from "./random";

export const baseNow = "2026-06-25T08:40:00.000Z";
const weekdays = [
  [1, 0.155],
  [2, 0.362],
  [3, 0.182],
  [4, 0.173],
  [5, 0.118],
  [6, 0.005],
  [0, 0.005],
] as const;
const hours = [
  [7, 3],
  [8, 8],
  [9, 18],
  [10, 17],
  [11, 9],
  [12, 5],
  [13, 6],
  [14, 15],
  [15, 12],
  [16, 5],
  [18, 2],
] as const;

export function sampleArrival(random: Random, month: number): Date {
  const year = 2024 + Math.floor(month / 12);
  const monthIndex = month % 12;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lastSundayMarch = new Date(Date.UTC(year, 2, 31));
  lastSundayMarch.setUTCDate(lastSundayMarch.getUTCDate() - lastSundayMarch.getUTCDay());
  const lastSundayOctober = new Date(Date.UTC(year, 9, 31));
  lastSundayOctober.setUTCDate(lastSundayOctober.getUTCDate() - lastSundayOctober.getUTCDay());
  const daylightStart = lastSundayMarch.getTime();
  const daylightEnd = lastSundayOctober.getTime();

  for (let attempt = 0; attempt < 100; attempt++) {
    let day = Math.floor(random() * daysInMonth) + 1;
    if (random() > 0.02) {
      const wanted = weighted(random, weekdays);
      const calendarDate = new Date(Date.UTC(year, monthIndex, day));
      day += (wanted - calendarDate.getUTCDay() + 7) % 7;
      if (day > daysInMonth) day -= 7;
    }

    const hour = weighted(random, hours);
    const localAsUtc = Date.UTC(
      year,
      monthIndex,
      day,
      hour,
      Math.floor(random() * 60),
      Math.floor(random() * 60),
    );
    const localDate = Date.UTC(year, monthIndex, day);
    const offset = localDate >= daylightStart && localDate < daylightEnd ? 2 : 1;
    const arrival = new Date(localAsUtc - offset * 60 * 60 * 1000);
    if (arrival.getTime() < Date.parse(baseNow)) return arrival;
  }

  throw new Error(`Could not sample an arrival before ${baseNow} in month ${month}.`);
}

export function burstTimes(start: Date, size: number, random: Random): Date[] {
  return Array.from(
    { length: size },
    (_, index) => new Date(start.getTime() + index * (2800 + random() * 6200)),
  );
}
