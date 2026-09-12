import { describe, expect, it } from "vitest";
import { createSeed } from "../data/seed";
import type { Booking } from "../types";
import { calendarHours, calendarPositions } from "./calendar";
import { addMonths, instant, money } from "./date";
import {
  createBooking,
  rescheduleBooking,
  saveService,
  saveStaff,
  saveSettings,
} from "./domain";
import { emailSchema, phoneSchema, serviceSchema } from "./validation";
const now = new Date("2026-09-09T00:00:00Z");
const event = (id: string, start: string, end: string) =>
  ({
    id,
    start: instant("2026-09-10", start).toISOString(),
    end: instant("2026-09-10", end).toISOString(),
  }) as Booking;
describe("Calendar layout", () => {
  it("uses consistent columns throughout chained overlaps", () => {
    const bookings = [
      event("a", "09:00", "10:00"),
      event("b", "09:30", "11:00"),
      event("c", "10:15", "11:30"),
    ];
    const positions = calendarPositions(bookings);
    expect(positions.get("a")).toEqual({ column: 0, columns: 2 });
    expect(positions.get("b")).toEqual({ column: 1, columns: 2 });
    expect(positions.get("c")).toEqual({ column: 0, columns: 2 });
  });
  it("does not overlap simultaneous appointments and restores full width afterward", () => {
    const positions = calendarPositions([
      event("a", "09:00", "10:00"),
      event("b", "09:00", "10:00"),
      event("c", "09:00", "10:00"),
      event("d", "10:00", "11:00"),
    ]);
    expect(
      new Set(["a", "b", "c"].map((id) => positions.get(id)?.column)).size,
    ).toBe(3);
    expect(positions.get("d")).toEqual({ column: 0, columns: 1 });
  });
  it("includes early and late appointments in the time grid", () => {
    const db = createSeed(now);
    const hours = calendarHours(db.settings, [
      event("a", "05:00", "06:00"),
      event("b", "22:00", "23:30"),
    ]);
    expect(hours[0]).toBe(5);
    expect(hours.at(-1)).toBe(23);
  });
  it("moves calendar months without skipping February or overflowing short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });
});
describe("Form and pricing regressions", () => {
  it("preserves booked duration and price when moving an edited or archived service", () => {
    const db = createSeed(now);
    db.bookings = [];
    const input = {
      customerId: "customer-1",
      serviceId: "svc-1",
      staffId: "staff-1",
      date: "2026-09-10",
      time: "10:00",
      paymentMethod: "Cash at studio" as const,
      notes: "",
    };
    const booking = createBooking(db, db.users[0], input, now);
    saveService(db, db.users[0], {
      ...db.services[0],
      duration: 90,
      price: 140,
      active: false,
    });
    rescheduleBooking(
      db,
      db.users[0],
      booking.id,
      { ...input, time: "17:00" },
      now,
    );
    expect(booking.duration).toBe(60);
    expect(booking.price).toBe(95);
    expect(booking.end).toBe(instant(input.date, "18:00").toISOString());
    expect(() =>
      createBooking(db, db.users[0], { ...input, time: "14:00" }, now),
    ).toThrow(/unavailable/);
  });
  it("shows cents and validates currency precision", () => {
    expect(money(95.75)).toBe("₱95.75");
    expect(money(95)).toBe("₱95");
    expect(
      serviceSchema.safeParse({ ...createSeed(now).services[0], price: 95.555 })
        .success,
    ).toBe(false);
  });
  it("normalizes email before validating and requires real phone digits", () => {
    expect(emailSchema.parse(" TEST@Example.com ")).toBe("test@example.com");
    expect(phoneSchema.safeParse("-------").success).toBe(false);
  });
  it("stores normalized staff and business profiles", () => {
    const db = createSeed(now);
    db.bookings = [];
    saveStaff(
      db,
      db.users[0],
      { ...db.staff[0], name: " Olivia Chen ", email: " OLIVIA@MORROW.DEMO " },
      now,
    );
    expect(db.staff[0].email).toBe("olivia@morrow.demo");
    expect(db.staff[0].name).toBe("Olivia Chen");
    saveSettings(
      db,
      db.users[0],
      {
        ...db.settings,
        name: " Morrow Studio ",
        email: " STUDIO@EXAMPLE.COM ",
      },
      now,
    );
    expect(db.settings.name).toBe("Morrow Studio");
    expect(db.settings.email).toBe("studio@example.com");
  });
});
