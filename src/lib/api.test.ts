import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { addDays, dateKey, weekday } from "./date";
let api: (typeof import("./api"))["api"];
let memory: Map<string, string>;
beforeEach(async () => {
  vi.resetModules();
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", {});
  api = (await import("./api")).api;
  await api.initialize();
});
afterEach(() => vi.unstubAllGlobals());
function futureInput() {
  let date = addDays(dateKey(), 25);
  if (weekday(date) === 0) date = addDays(date, 1);
  return {
    customerId: "customer-1",
    serviceId: "svc-1",
    staffId: "staff-1",
    date,
    time: "10:00",
    notes: "",
  };
}
describe("Local API integration", () => {
  it("serializes concurrent bookings and saves just one winner", async () => {
    const input = futureInput();
    const results = await Promise.allSettled([
      api.book(input),
      api.book({ ...input, customerId: "customer-2" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const matching = api
      .snapshot()
      .db!.bookings.filter(
        (b) => b.start.startsWith(input.date) && b.staffId === "staff-1",
      );
    expect(matching).toHaveLength(1);
  });
  it("registers, verifies passwords, persists profile edits and rejects duplicate accounts", async () => {
    const profile = {
      name: "Casey Rivera",
      email: " CASEY@example.com ",
      phone: "+886 900 123 456",
      password: "SecureTest2026!",
    };
    await api.register(profile);
    expect(api.snapshot().user?.role).toBe("customer");
    const id = api.snapshot().user!.id;
    const raw = JSON.parse(memory.get("morrow.database.v1")!);
    const saved = raw.users.find((u: { id: string }) => u.id === id);
    expect(saved.passwordHash).toHaveLength(64);
    expect(saved.passwordHash).not.toBe(profile.password);
    expect(saved.password).toBeUndefined();
    await api.saveProfile({
      name: "Casey R",
      email: "casey@example.com",
      phone: "+886 900 222 333",
      currentPassword: profile.password,
      password: "NewPassword2026!",
    });
    api.logout();
    await expect(
      api.login("casey@example.com", profile.password),
    ).rejects.toThrow(/incorrect/);
    await api.login("casey@example.com", "NewPassword2026!");
    expect(api.snapshot().user?.name).toBe("Casey R");
    await expect(api.register(profile)).rejects.toThrow(/already exists/);
  });
  it("accepts the seeded administrator email regardless of case", async () => {
    await api.login("ADMIN@BOOKSYNC.DEMO", "Morrow2026!");
    expect(api.snapshot().user?.role).toBe("admin");
    expect(api.snapshot().user?.email).toBe("admin@BookSync.demo");
  });
  it("enforces customer visibility, ownership, and administrator permissions at the API boundary", async () => {
    await api.login("emma.thompson@example.com", "Morrow2026!");
    const snapshot = api.snapshot();
    expect(snapshot.db!.users.every((u) => u.id === snapshot.user!.id)).toBe(
      true,
    );
    expect(
      snapshot.db!.bookings.every((b) => b.customerId === snapshot.user!.id),
    ).toBe(true);
    await expect(api.saveService(snapshot.db!.services[0])).rejects.toThrow(
      /administrator/,
    );
    await expect(api.saveSettings(snapshot.db!.settings)).rejects.toThrow(
      /administrator/,
    );
    await expect(
      api.book({ ...futureInput(), customerId: "customer-2" }),
    ).rejects.toThrow(/yourself/);
  });
  it("allows new staff to sign in and rejects inactive staff", async () => {
    const template = api.snapshot().db!.staff[0];
    await api.saveStaff(
      {
        ...template,
        id: "",
        name: "Taylor Green",
        email: " TAYLOR@example.com ",
      },
      "SecureTest2026!",
    );
    const member = api
      .snapshot()
      .db!.staff.find((s) => s.name === "Taylor Green")!;
    await api.login("taylor@example.com", "SecureTest2026!");
    expect(api.snapshot().user?.staffId).toBe(member.id);
    await expect(api.saveStaff(member)).rejects.toThrow(/administrator/);
    await api.login("admin@BookSync.demo", "Morrow2026!");
    await api.saveStaff({ ...member, active: false });
    await expect(
      api.login("taylor@example.com", "SecureTest2026!"),
    ).rejects.toThrow(/inactive/);
  });
  it("does not overwrite saved bookings if browser storage is full", async () => {
    const before = memory.get("morrow.database.v1");
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    await expect(api.book(futureInput())).rejects.toThrow(/Unable to save/);
    expect(memory.get("morrow.database.v1")).toBe(before);
  });
  it("rejects unauthorized availability exclusions and enforces signed-out access", async () => {
    const other = api
      .snapshot()
      .db!.bookings.find((b) => b.customerId !== "customer-1")!;
    await api.login("emma.thompson@example.com", "Morrow2026!");
    expect(api.slots(futureInput(), other.id)).toEqual([]);
    api.logout();
    await expect(api.book(futureInput())).rejects.toThrow(/sign in/);
    expect(api.snapshot().user).toBeNull();
  });
});
