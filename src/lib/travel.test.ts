import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "../data/seed";
import { travelSeed } from "../data/travelSeed";
import {
  quote,
  reserve,
  roomsLeft,
  reservationStatus,
  saveRoom,
  saveProperty,
  savePromotion,
  saveExperience,
  validateDates,
  canAccessReservation,
  type ReservationInput,
} from "./travel";
import type { Database, User } from "../types";
let db: Database,
  admin: User,
  guest: User,
  staff: User,
  input: ReservationInput;
const now = new Date("2026-10-01T01:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  db = createSeed(now);
  db.travel = travelSeed(now);
  db.travel.reservations = [];
  admin = db.users.find((u) => u.role === "admin")!;
  guest = db.users.find((u) => u.id === "customer-1")!;
  staff = db.users.find((u) => u.staffId === "staff-1")!;
  input = {
    customerId: guest.id,
    roomId: "palawan-garden",
    checkIn: "2026-10-10",
    checkOut: "2026-10-12",
    guests: 2,
    guestName: guest.name,
    email: guest.email,
    phone: guest.phone,
    paymentMethod: "GCash",
    promotionCode: "",
    experienceIds: [],
    notes: "",
  };
});
afterEach(() => vi.useRealTimers());
describe("Overnight resort reservations", () => {
  it("calculates nightly totals, room-only offers, and one-off experiences", () => {
    const q = quote(
      db.travel!,
      {
        ...input,
        promotionCode: "slowdays",
        experienceIds: ["palawan-journey"],
      },
      now,
    );
    expect(q.nights).toBe(2);
    expect(q.subtotal).toBe(11600);
    expect(q.discount).toBe(1160);
    expect(q.total).toBe(12840);
  });
  it("creates a pending guest request and queues an event with no payment collection", () => {
    const r = reserve(db, guest, input, now);
    expect(r.status).toBe("Pending");
    expect(r.createdAt).toBe(now.toISOString());
    expect(db.travel!.events[0].delivery).toBe("queued");
    expect(r.paymentMethod).toBe("GCash");
  });
  it("allows inventory-count reservations and rejects the next overlap on any night", () => {
    const room = db.travel!.rooms[0];
    room.inventory = 2;
    reserve(db, admin, input, now);
    reserve(
      db,
      admin,
      { ...input, checkIn: "2026-10-11", checkOut: "2026-10-13" },
      now,
    );
    expect(roomsLeft(db.travel!, room, input.checkIn, input.checkOut)).toBe(0);
    expect(() => reserve(db, guest, input, now)).toThrow(/fully booked/);
    expect(() =>
      reserve(
        db,
        guest,
        { ...input, checkIn: "2026-10-13", checkOut: "2026-10-14" },
        now,
      ),
    ).not.toThrow();
  });
  it("uses nightly peak occupancy rather than counting all intersecting reservations", () => {
    const room = db.travel!.rooms[0];
    room.inventory = 2;
    reserve(db, admin, { ...input, checkOut: "2026-10-11" }, now);
    reserve(db, admin, { ...input, checkIn: "2026-10-11" }, now);
    expect(roomsLeft(db.travel!, room, input.checkIn, input.checkOut)).toBe(1);
  });
  it("rejects past, malformed, impossible, reversed, and excessive dates", () => {
    for (const [start, end] of [
      ["2026-09-30", "2026-10-02"],
      ["2026-02-30", "2026-10-01"],
      ["bad", "2026-10-10"],
      ["2026-10-12", "2026-10-10"],
      ["2026-10-10", "2026-10-10"],
      ["2026-10-10", "2026-11-10"],
    ])
      expect(() => validateDates(start, end, now)).toThrow();
  });
  it("rejects too many guests, fractional guests, unknown rooms and inactive properties", () => {
    expect(() => quote(db.travel!, { ...input, guests: 3 }, now)).toThrow(
      /capacity/,
    );
    expect(() => quote(db.travel!, { ...input, guests: 1.5 }, now)).toThrow();
    expect(() =>
      quote(db.travel!, { ...input, roomId: "missing" }, now),
    ).toThrow(/unavailable/);
    db.travel!.properties[0].active = false;
    expect(() => quote(db.travel!, input, now)).toThrow(/unavailable/);
  });
  it("rejects closures on occupied nights but allows a closure on check-out", () => {
    db.travel!.rooms[0].blockedDates = ["2026-10-12"];
    expect(() => quote(db.travel!, input, now)).not.toThrow();
    db.travel!.rooms[0].blockedDates = ["2026-10-11"];
    expect(() => quote(db.travel!, input, now)).toThrow(/closed/);
  });
  it("rejects invalid promotions and experiences from other resorts", () => {
    expect(() =>
      quote(db.travel!, { ...input, promotionCode: "BOGUS" }, now),
    ).toThrow(/expired/);
    expect(() =>
      quote(db.travel!, { ...input, experienceIds: ["bohol-table"] }, now),
    ).toThrow(/unavailable/);
    expect(() =>
      quote(
        db.travel!,
        { ...input, experienceIds: ["palawan-table", "palawan-table"] },
        now,
      ),
    ).toThrow(/once/);
  });
  it("reschedules atomically, retains booked rate and confirmation, and releases old nights", () => {
    db.travel!.rooms[0].inventory = 1;
    const r = reserve(db, admin, input, now);
    db.travel!.rooms[0].price = 9000;
    reserve(
      db,
      admin,
      { ...input, checkIn: "2026-10-15", checkOut: "2026-10-17" },
      now,
    );
    const before = structuredClone(r);
    expect(() =>
      reserve(
        db,
        guest,
        { ...input, checkIn: "2026-10-15", checkOut: "2026-10-17" },
        now,
        r.id,
      ),
    ).toThrow(/fully booked/);
    expect(r).toEqual(before);
    const moved = reserve(
      db,
      guest,
      { ...input, checkIn: "2026-10-20", checkOut: "2026-10-22" },
      now,
      r.id,
    );
    expect(moved.id).toBe(r.id);
    expect(moved.nightlyRate).toBe(5800);
    expect(moved.status).toBe("Confirmed");
    expect(
      roomsLeft(db.travel!, db.travel!.rooms[0], input.checkIn, input.checkOut),
    ).toBe(1);
  });
  it("cancels, preserves history, releases inventory and prevents reactivation", () => {
    db.travel!.rooms[0].inventory = 1;
    const r = reserve(db, guest, input, now);
    reservationStatus(db, guest, r.id, "Cancelled", now);
    expect(db.travel!.reservations).toHaveLength(1);
    expect(
      roomsLeft(db.travel!, db.travel!.rooms[0], input.checkIn, input.checkOut),
    ).toBe(1);
    expect(() => reservationStatus(db, admin, r.id, "Confirmed", now)).toThrow(
      /closed/,
    );
  });
  it("enforces guest ownership and assigned-property staff access", () => {
    const r = reserve(db, admin, input, now);
    const other = db.users.find((u) => u.id === "customer-2")!;
    expect(canAccessReservation(db.travel!, other, r)).toBe(false);
    expect(() =>
      reserve(db, guest, { ...input, customerId: other.id }, now),
    ).toThrow(/yourself/);
    expect(() => reservationStatus(db, other, r.id, "Cancelled", now)).toThrow(
      /denied/,
    );
    expect(() =>
      reserve(db, staff, { ...input, roomId: "bohol-garden" }, now),
    ).toThrow(/permissions/);
    expect(() => reservationStatus(db, guest, r.id, "Completed", now)).toThrow(
      /cancel/,
    );
  });
  it("prevents premature completion and no-show but allows completion after check-out", () => {
    const r = reserve(db, admin, input, now);
    expect(() => reservationStatus(db, admin, r.id, "Completed", now)).toThrow(
      /check-out/,
    );
    expect(() => reservationStatus(db, admin, r.id, "No-show", now)).toThrow(
      /check-in/,
    );
    reservationStatus(
      db,
      admin,
      r.id,
      "Completed",
      new Date("2026-10-12T02:00:00Z"),
    );
    expect(r.status).toBe("Completed");
  });
  it("rejects inventory/closure/archive changes that invalidate existing stays", () => {
    const r = db.travel!.rooms[0];
    r.inventory = 2;
    reserve(db, admin, input, now);
    reserve(db, admin, input, now);
    expect(() => saveRoom(db, admin, { ...r, inventory: 1 })).toThrow(
      /conflicts/,
    );
    expect(() =>
      saveRoom(db, staff, { ...r, blockedDates: [input.checkIn] }),
    ).toThrow(/conflicts/);
    expect(() =>
      saveProperty(db, admin, { ...db.travel!.properties[0], active: false }),
    ).toThrow(/upcoming/);
  });
  it("permits staff inventory management while protecting prices and unrelated properties", () => {
    const r = db.travel!.rooms[0];
    saveRoom(db, staff, { ...r, inventory: 3 });
    expect(r.inventory).toBe(3);
    expect(() => saveRoom(db, staff, { ...r, price: 9900 })).toThrow(/only/);
    expect(() => saveRoom(db, guest, r)).toThrow(/assigned/);
    expect(() =>
      saveRoom(
        db,
        staff,
        db.travel!.rooms.find((r) => r.propertyId === "bohol")!,
      ),
    ).toThrow(/assigned/);
    expect(() => saveProperty(db, staff, db.travel!.properties[0])).toThrow(
      /administrator/,
    );
  });
  it("manages unique offers and experiences only as administrator and preserves booked snapshots", () => {
    const r = reserve(
      db,
      admin,
      { ...input, experienceIds: ["palawan-table"] },
      now,
    );
    const e = db.travel!.experiences.find((e) => e.id === "palawan-table")!;
    saveExperience(db, admin, { ...e, price: 3500 });
    expect(r.experiences[0].price).toBe(1800);
    expect(() => saveExperience(db, staff, e)).toThrow(/administrator/);
    const p = db.travel!.promotions[0];
    expect(() => savePromotion(db, admin, { ...p, id: "" })).toThrow(/exists/);
    expect(() => savePromotion(db, guest, p)).toThrow(/administrator/);
  });
  it("uses Manila calendar days across the UTC midnight boundary", () => {
    expect(() =>
      validateDates(
        "2026-10-01",
        "2026-10-02",
        new Date("2026-10-01T17:00:00Z"),
      ),
    ).toThrow(/past/);
  });
});
