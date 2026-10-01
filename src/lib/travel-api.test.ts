import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { dateKey, addDays } from "./date";
let api: (typeof import("./api"))["api"], memory: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
  });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", {});
  api = (await import("./api")).api;
  await api.initialize();
});
afterEach(() => vi.unstubAllGlobals());
const input = () => ({
  roomId: "palawan-garden",
  customerId: "customer-1",
  guestName: "Demo Guest",
  email: "guest@example.com",
  phone: "+63 917 123 4567",
  checkIn: addDays(dateKey(), 60),
  checkOut: addDays(dateKey(), 62),
  guests: 2,
  experienceIds: [],
  promotionCode: "",
  paymentMethod: "GCash" as const,
  notes: "",
});
describe("Travel API persistence and permissions", () => {
  it("opens a new database publicly and excludes all guest data from its catalog", () => {
    expect(api.snapshot().user).toBeNull();
    const data = api.catalog();
    expect(data.properties).toHaveLength(4);
    expect(data.reservations).toEqual([]);
    expect(data.events).toEqual([]);
    expect(JSON.stringify(data)).not.toContain("guestName");
  });
  it("preserves legacy bookings and accounts when adding travel data", async () => {
    await api.login("admin@BookSync.demo", "Morrow2026!");
    const original = api.snapshot().db!;
    const raw = JSON.parse(memory.get("morrow.database.v1")!);
    delete raw.travel;
    memory.set("morrow.database.v1", JSON.stringify(raw));
    vi.resetModules();
    const fresh = (await import("./api")).api;
    await fresh.initialize();
    expect(fresh.snapshot().db!.bookings).toEqual(original.bookings);
    expect(fresh.snapshot().db!.users.map((u) => u.email)).toEqual(
      original.users.map((u) => u.email),
    );
    expect(fresh.catalog().rooms).toHaveLength(8);
  });
  it("serializes the last room and persists exactly one winning reservation", async () => {
    await api.login("admin@BookSync.demo", "Morrow2026!");
    const room = api.catalog().rooms[0];
    await api.saveRoom({ ...room, inventory: 1 });
    const results = await Promise.allSettled([
      api.reserve(input()),
      api.reserve(input()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(api.available(room.id, input().checkIn, input().checkOut)).toBe(0);
  });
  it("limits guest history and rejects management and another guest cancellation", async () => {
    await api.login("admin@BookSync.demo", "Morrow2026!");
    const r = await api.reserve(input());
    await api.login("liam.anderson@example.com", "Morrow2026!");
    expect(
      api.snapshot().db!.travel!.reservations.some((x) => x.id === r.id),
    ).toBe(false);
    await expect(api.reservationStatus(r.id, "Cancelled")).rejects.toThrow(
      /denied/,
    );
    await expect(api.saveRoom(api.catalog().rooms[0])).rejects.toThrow(
      /assigned/,
    );
  });
  it("rejects duplicate registration, validates profiles, and persists a new guest session", async () => {
    const details = {
      name: "A New Guest",
      email: "new@example.com",
      phone: "+63 917 123 4567",
      password: "TravelDemo2026!",
    };
    await api.register(details);
    expect(api.snapshot().user?.role).toBe("customer");
    await expect(
      api.register({ ...details, email: " NEW@example.com " }),
    ).rejects.toThrow(/already exists/);
    await expect(
      api.saveProfile({ name: "New Name", email: details.email, phone: "bad" }),
    ).rejects.toThrow();
    const r = await api.reserve({
      ...input(),
      customerId: api.snapshot().user!.id,
    });
    expect(r.status).toBe("Pending");
    api.logout();
    await api.login(details.email, details.password);
    expect(api.snapshot().db!.travel!.reservations.map((r) => r.id)).toContain(
      r.id,
    );
  });
});
