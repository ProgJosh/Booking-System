import type { Booking, Settings } from "../types";
import { minutes, timeKey } from "./date";

/** Give each connected set of overlapping events stable, non-overlapping columns. */
export function calendarPositions(bookings: Booking[]) {
  const positions = new Map<string, { column: number; columns: number }>();
  const sorted = [...bookings].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  let group: { booking: Booking; column: number }[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    group.forEach(({ booking, column }) =>
      positions.set(booking.id, { column, columns: columnEnds.length }),
    );
    group = [];
    columnEnds = [];
    groupEnd = -Infinity;
  };
  for (const booking of sorted) {
    const start = Date.parse(booking.start),
      end = Date.parse(booking.end);
    if (start >= groupEnd) flush();
    let column = columnEnds.findIndex((value) => value <= start);
    if (column < 0) column = columnEnds.length;
    columnEnds[column] = end;
    group.push({ booking, column });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return positions;
}

/** Include every appointment even when a studio extends its hours. */
export function calendarHours(settings: Settings, bookings: Booking[]) {
  const openings = settings.schedule
    .filter((d) => d.open)
    .map((d) => minutes(d.start));
  const closings = settings.schedule
    .filter((d) => d.open)
    .map((d) => minutes(d.end));
  const first = Math.floor(
    Math.min(
      7 * 60,
      ...openings,
      ...bookings.map((b) => minutes(timeKey(b.start))),
    ) / 60,
  );
  const last = Math.min(
    24,
    Math.ceil(
      Math.max(
        20 * 60,
        ...closings,
        ...bookings.map((b) => minutes(timeKey(b.end))),
      ) / 60,
    ),
  );
  return Array.from({ length: last - first }, (_, i) => first + i);
}
