import { expect, test, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find your kind/ }),
  ).toBeVisible();
}
async function demo(page: Page, role: string) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: role + " demo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "Guest" ? "Your reservations" : /Welcome back/,
    }),
  ).toBeVisible();
}
function date(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
async function room(page: Page) {
  await page.goto("/#property/palawan");
  await expect(
    page.getByRole("heading", { name: "The Cove at El Nido", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reserve this room", exact: true })
    .first()
    .click();
}
async function stayStep(page: Page, days = 45) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Check-in", { exact: true }).fill(date(days));
  await dialog.getByLabel("Check-out", { exact: true }).fill(date(days + 2));
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Who is coming along?" }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("public search, filters, sorting, gallery and destination navigation", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Where to?").selectOption("Benguet, Cordillera");
  await page
    .getByRole("button", { name: "Find my escape", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next good place." }),
  ).toBeVisible();
  await expect(page.locator(".stay-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Island", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /A different date/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(page.locator(".stay-card")).toHaveCount(4);
  await page.getByLabel("Sort by").selectOption("price");
  await expect(page.locator(".stay-card h3").first()).toHaveText(
    "Fern & Pine Lodge",
  );
  await page.getByRole("button", { name: "Explore Fern & Pine Lodge" }).click();
  await page.getByRole("button", { name: "Next photograph" }).click();
  await expect(page.locator(".property-gallery>span")).toContainText("2 /");
  await noOverflow(page);
});
test("registration, complete reservation, banking preference, history, reschedule and cancellation", async ({
  page,
}) => {
  await ready(page);
  await room(page);
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Demo Traveler");
  await page
    .getByLabel("Phone number", { exact: true })
    .fill("+63 917 123 4567");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("traveler@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TravelDemo2026!");
  await page
    .getByRole("button", { name: "Create guest account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const d = page.getByRole("dialog");
  await d.getByLabel("Offer code (optional)").fill("SLOWDAYS");
  await d.locator(".extra-options input").first().check();
  await stayStep(page);
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await d.getByRole("radio", { name: "GoTyme Bank", exact: true }).check();
  await expect(d.locator(".price-breakdown")).toContainText("₱12,840");
  await page.screenshot({
    path: "test-results/review-desktop.png",
    fullPage: false,
  });
  await d.getByRole("button", { name: "Request reservation" }).click();
  await expect(
    page.getByRole("heading", { name: "Your escape is taking shape." }),
  ).toBeVisible();
  await expect(d.getByText("Pending", { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "View my reservations" }).click();
  await page.reload();
  await expect(page.locator(".reservation-card")).toHaveCount(1);
  await page.getByRole("button", { name: "View reservation" }).click();
  await expect(d.getByText(/GoTyme Bank · Preference/)).toBeVisible();
  await d.getByRole("button", { name: "Change dates" }).click();
  await stayStep(page, 50);
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await d.getByRole("button", { name: "Save new dates" }).click();
  await expect(
    page.getByRole("heading", { name: "Your dates are updated." }),
  ).toBeVisible();
  await d.getByRole("button", { name: "View my reservations" }).click();
  await expect(page.locator(".reservation-card")).toContainText(date(50));
  await page.getByRole("button", { name: "View reservation" }).click();
  await d
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await d.getByRole("button", { name: "Yes, cancel reservation" }).click();
  await expect(page.locator(".reservation-card")).toContainText("Cancelled");
  await noOverflow(page);
});
test("login errors and account profile updates persist", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill("wrong@example.com");
  await page.getByLabel("Password", { exact: true }).fill("badpass123");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByRole("button", { name: "Guest demo", exact: true }).click();
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await page.getByLabel("Phone number").fill("+63 918 123 4567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("up to date");
  await page.reload();
  await expect(page.getByLabel("Phone number")).toHaveValue("+63 918 123 4567");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Find your kind/ }),
  ).toBeVisible();
});
test("admin properties, inventory, promotions, guest and team accounts, reports and calendar", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Admin");
  const nav = page.getByRole("navigation", { name: "Management areas" });
  await nav.getByRole("button", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("A Quiet Demo Retreat");
  await d
    .getByLabel("Destination", { exact: true })
    .fill("Zambales, Philippines");
  await d
    .getByLabel("Location (sample address)")
    .fill("Sample location · San Felipe, Zambales");
  await d
    .getByLabel("Description", { exact: true })
    .fill(
      "A welcoming fictional beach retreat with relaxed mornings and thoughtful spaces.",
    );
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Demo Retreat", exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Rooms", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Edit Garden King palawan-garden",
      exact: true,
    })
    .click();
  await d.getByLabel("Rooms of this type").fill("1");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav.getByRole("button", { name: "Offers", exact: true }).click();
  await page.getByRole("button", { name: "Add offer", exact: true }).click();
  await d.getByLabel("Offer code").fill("DEMO15");
  await d.getByLabel("Offer title").fill("Weekend demo escape");
  await d
    .getByLabel("Offer description")
    .fill("Save a little on your next fictional escape.");
  await d.getByLabel("Room discount (%)").fill("15");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator(".management-card").filter({ hasText: "DEMO15" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Guests", exact: true }).click();
  await page.getByRole("button", { name: "Add guest", exact: true }).click();
  await d.getByLabel("Full name").fill("Guest Admin Test");
  await d.getByLabel("Email address").fill("admin-created@example.com");
  await d.getByLabel("Phone number").fill("+63 917 000 0000");
  await d.getByLabel("Initial login password").fill("GuestDemo2026!");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Guest Admin Test" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "Add team member" }).click();
  await d.getByLabel("Full name").fill("Travel Host Test");
  await d.getByLabel("Email address").fill("host-test@example.com");
  await d.getByLabel("Initial login password").fill("HostDemo2026!");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Travel Host Test" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stay & revenue reports" }),
  ).toBeVisible();
  const expected = await page.evaluate(async () => {
    const path = "/src/lib/api.ts";
    const { api } = await import(path);
    return api
      .snapshot()
      .db.travel.reservations.filter(
        (r: { status: string }) => r.status === "Completed",
      )
      .reduce((s: number, r: { total: number }) => s + r.total, 0);
  });
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(expected);
  await expect(page.locator(".travel-stats")).toContainText(formatted);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export reservations CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "alder-tide-reservations.csv",
  );
  await nav.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".stay-calendar")).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await noOverflow(page);
});
test("last-room concurrent requests serialize and failed reschedule leaves original dates intact", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Admin");
  const result = await page.evaluate(
    async ({ start, end, nextStart, nextEnd }) => {
      const path = "/src/lib/api.ts";
      const { api } = await import(path);
      const db = api.snapshot().db;
      const room = db.travel.rooms.find(
        (r: { id: string }) => r.id === "palawan-garden",
      );
      await api.saveRoom({ ...room, inventory: 1 });
      const g = db.users.find((u: { role: string }) => u.role === "customer");
      const input = {
        roomId: room.id,
        customerId: g.id,
        guestName: g.name,
        email: g.email,
        phone: g.phone,
        guests: 2,
        checkIn: start,
        checkOut: end,
        experienceIds: [],
        promotionCode: "",
        paymentMethod: "GCash",
        notes: "",
      };
      const attempts = await Promise.allSettled([
        api.reserve(input),
        api.reserve(input),
      ]);
      const saved = api
        .snapshot()
        .db.travel.reservations.find(
          (r: { checkIn: string }) => r.checkIn === start,
        );
      await api.reserve({ ...input, checkIn: nextStart, checkOut: nextEnd });
      let blocked = false;
      try {
        await api.reserve(
          { ...input, checkIn: nextStart, checkOut: nextEnd },
          saved.id,
        );
      } catch {
        blocked = true;
      }
      return {
        fulfilled: attempts.filter((a) => a.status === "fulfilled").length,
        blocked,
        checkIn: api
          .snapshot()
          .db.travel.reservations.find((r: { id: string }) => r.id === saved.id)
          .checkIn,
      };
    },
    { start: date(60), end: date(62), nextStart: date(65), nextEnd: date(67) },
  );
  expect(result).toEqual({ fulfilled: 1, blocked: true, checkIn: date(60) });
});
test("staff sees assigned stays and cannot modify property identity, offers or other properties", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Staff");
  const nav = page.getByRole("navigation", { name: "Management areas" });
  await expect(
    nav.getByRole("button", { name: "Offers", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Rooms", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Edit Garden King palawan-garden",
      exact: true,
    })
    .click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Nightly price (PHP)")).toBeDisabled();
  await d.getByLabel("Rooms of this type").fill("5");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(d).not.toBeVisible();
  const denial = await page.evaluate(async () => {
    const path = "/src/lib/api.ts";
    const { api } = await import(path);
    try {
      await api.saveProperty(api.catalog().properties[0]);
      return false;
    } catch {
      return true;
    }
  });
  expect(denial).toBe(true);
});
test("unavailable dates, invalid offers and excess guest counts are rejected", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Guest");
  await room(page);
  const d = page.getByRole("dialog");
  await d.getByLabel("Offer code (optional)").fill("INVALID");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("expired");
  await d.getByLabel("Offer code (optional)").fill("");
  await d.getByLabel("Check-in", { exact: true }).fill(date(-1));
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    d.getByRole("heading", { name: "A little extra to look forward to" }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/#stays");
  await page.getByLabel("Guests", { exact: true }).selectOption("12");
  await page.getByRole("button", { name: "Find my escape" }).click();
  await expect(
    page.getByRole("heading", { name: /A different date/ }),
  ).toBeVisible();
});
for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 1040 },
])
  test(
    viewport.name +
      " layouts, images, mobile navigation, booking and reduced motion",
    async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const failures: string[] = [];
      page.on("pageerror", (e) => failures.push(e.message));
      await ready(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator(".travel-reveal").first()).toHaveCSS(
        "opacity",
        "1",
      );
      for (const img of await page.locator("img:visible").all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/home-" + viewport.name + ".png",
        fullPage: true,
      });
      if (viewport.width < 1000) {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("button", { name: "Stays", exact: true })
          .click();
      } else
        await page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("button", { name: "Stays", exact: true })
          .click();
      await expect(page.locator(".stay-card")).toHaveCount(4);
      await noOverflow(page);
      await page
        .getByRole("button", { name: "Explore The Cove at El Nido" })
        .click();
      await page.screenshot({
        path: "test-results/property-" + viewport.name + ".png",
        fullPage: true,
      });
      await noOverflow(page);
      await page
        .getByRole("button", { name: "Reserve this room", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Guest demo" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await stayStep(page);
      const d = page.getByRole("dialog");
      await d.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(d.getByRole("radio")).toHaveCount(8);
      await d.getByRole("radio", { name: "BPI Mobile App" }).check();
      await expect(
        d.getByRole("radio", { name: "BPI Mobile App" }),
      ).toBeChecked();
      expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: "test-results/booking-" + viewport.name + ".png",
      });
      await page.keyboard.press("Escape");
      await expect(d).not.toBeVisible();
      const broken = await page
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
        );
      expect(broken).toEqual([]);
      expect(failures).toEqual([]);
    },
  );

test("admin confirms guest requests and guest history links apply the guest filter", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Guest");
  await room(page);
  await stayStep(page, 70);
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await d.getByRole("button", { name: "Request reservation" }).click();
  await d.getByRole("button", { name: "View my reservations" }).click();
  const reference = await page
    .locator(".reservation-card .eyebrow")
    .first()
    .textContent();
  await page.getByRole("button", { name: "Sign out" }).click();
  await demo(page, "Admin");
  const nav = page.getByRole("navigation", { name: "Management areas" });
  await nav.getByRole("button", { name: "Reservations", exact: true }).click();
  await page.getByLabel("Search reservations").fill(reference!);
  await page.getByRole("button", { name: "View reservation" }).click();
  await expect(d.getByRole("button", { name: "Complete stay" })).toBeDisabled();
  await d.getByRole("button", { name: "Confirm request" }).click();
  await expect(page.locator(".reservation-card")).toContainText("Confirmed");
  await nav.getByRole("button", { name: "Guests", exact: true }).click();
  const guest = page
    .locator(".management-card")
    .filter({ hasText: "emmanuel.josh.velo@example.com" });
  await guest
    .getByRole("button", { name: "Browse guest reservations" })
    .click();
  await expect(page.getByLabel("Search reservations")).toHaveValue(
    "emmanuel.josh.velo@example.com",
  );
  await expect(page.locator(".reservation-card")).toHaveCount(1);
});
test("separate tabs protect the last room through the IndexedDB coordination fallback", async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    }),
  );
  await ready(page);
  await demo(page, "Admin");
  await page.evaluate(async () => {
    const path = "/src/lib/api.ts";
    const { api } = await import(path);
    await api.saveRoom({ ...api.catalog().rooms[0], inventory: 1 });
  });
  const second = await context.newPage();
  await ready(second);
  const input = {
    roomId: "palawan-garden",
    customerId: "customer-1",
    guestName: "Demo Guest",
    email: "race@example.com",
    phone: "+63 917 123 4567",
    checkIn: date(80),
    checkOut: date(82),
    guests: 2,
    experienceIds: [],
    promotionCode: "",
    paymentMethod: "GCash",
    notes: "",
  };
  const attempt = (p: Page) =>
    p.evaluate(async (value) => {
      const path = "/src/lib/api.ts";
      const { api } = await import(path);
      try {
        await api.reserve(value);
        return "saved";
      } catch (err) {
        return (err as Error).message;
      }
    }, input);
  const results = await Promise.all([attempt(page), attempt(second)]);
  expect(results.filter((r) => r === "saved")).toHaveLength(1);
  expect(results.some((r) => r.includes("fully booked"))).toBe(true);
  await second.close();
});
test("narrow mobile management and keyboard modal focus remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await ready(page);
  await demo(page, "Admin");
  await noOverflow(page);
  await page
    .getByRole("navigation", { name: "Management areas" })
    .getByRole("button", { name: "Rooms", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Edit Garden King palawan-garden",
      exact: true,
    })
    .click();
  const d = page.getByRole("dialog");
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(d).not.toBeVisible();
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await noOverflow(page);
});

test("a property without active rooms and empty management search show useful states", async ({
  page,
}) => {
  await ready(page);
  await demo(page, "Admin");
  const id = await page.evaluate(async () => {
    const path = "/src/lib/api.ts";
    const { api } = await import(path);
    const original = api.catalog().properties[0];
    await api.saveProperty({
      ...original,
      id: "",
      name: "Unreleased demo property",
    });
    return api
      .catalog()
      .properties.find(
        (p: { name: string }) => p.name === "Unreleased demo property",
      ).id;
  });
  await page
    .getByRole("navigation", { name: "Management areas" })
    .getByRole("button", { name: "Properties", exact: true })
    .click();
  await page.getByLabel("Search properties").fill("nothingmatches");
  await expect(
    page.getByText(
      "No items match your search. Try another name or clear the search.",
    ),
  ).toBeVisible();
  await page.goto("/#property/" + id);
  await expect(
    page.getByRole("heading", { name: "This stay is unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore stays", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});
