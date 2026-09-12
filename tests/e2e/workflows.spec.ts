import { expect, test, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening), Emmanuel/ }),
  ).toBeVisible();
}
async function selectFutureDate(page: Page, days = 20) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  await page.getByLabel("Appointment date").fill(key);
  return key;
}
async function createAppointment(page: Page) {
  await page
    .getByRole("button", { name: "New appointment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Signature Massage/ }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("Choose your provider").selectOption("staff-1");
  const date = await selectFutureDate(page);
  await dialog.getByRole("button", { name: "10:00 AM", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("radio", { name: "Maya Use your Maya wallet", exact: true }).click();
  await dialog.getByLabel("Appointment notes").fill("Browser test appointment");
  await dialog
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "It’s in the calendar." }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-card")).toContainText("Maya");
  const id = await page.locator(".confirmation-card .eyebrow").innerText();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  return { id, date };
}
async function findBooking(page: Page, id: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Appointments/ })
    .click();
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await page.getByLabel("Search appointments").fill(id);
  await page.getByRole("button", { name: /View appointment for/ }).click();
}
test("dashboard, all main pages, calendar and desktop screenshot", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  for (const [nav, title] of [
    ["Calendar", "Your calendar"],
    ["Appointments", "Appointments"],
    ["Customers", "Your customers"],
    ["Services", "Our services"],
    ["Team", "Your team"],
    ["Reports", "Reports & insights"],
  ] as const) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: new RegExp(nav) })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Business settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save business settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Business settings saved.");
  expect(errors).toEqual([]);
});
test("booking, rescheduling, persistence, cancellation and notification queue", async ({
  page,
}) => {
  await ready(page);
  const { id } = await createAppointment(page);
  await findBooking(page, id);
  await expect(page.getByRole("dialog")).toContainText("PAYMENT METHOD");
  await expect(page.getByRole("dialog")).toContainText("Maya");
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "11:00 AM", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /GoTyme Bank/ }).click();
  await page.getByRole("button", { name: "Save new appointment time" }).click();
  await expect(
    page.getByRole("heading", { name: "Your new time is saved." }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-card")).toContainText("GoTyme Bank");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await page.getByLabel("Search appointments").fill(id);
  await expect(page.locator("tbody")).toContainText("11:00 AM");
  await page.getByRole("button", { name: /View appointment for/ }).click();
  await expect(page.getByRole("dialog")).toContainText("GoTyme Bank");
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, cancel appointment" }).click();
  await expect(page.getByRole("status")).toHaveText("Appointment cancelled.");
  await expect(page.locator("tbody")).toContainText("Cancelled");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Signature Massage · Cancelled",
  );
});
test("admin service, customer and staff management", async ({ page }) => {
  await ready(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Services", exact: true })
    .click();
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page.getByLabel("Service name", { exact: true }).fill("Rest & Restore");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A gentle restorative wellness session.");
  await page.getByLabel("Duration (minutes)").fill("45");
  await page.getByLabel("Price (PHP)").fill("75");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Rest & Restore" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Rest & Restore", exact: true })
    .click();
  await page.getByLabel("Price (PHP)").fill("85");
  await page.getByLabel("Available for new bookings").uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator(".service-card").filter({ hasText: "Rest & Restore" }),
  ).toContainText("Inactive");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Customers", exact: true })
    .click();
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Test Customer");
  await page
    .getByLabel("Email", { exact: true })
    .fill("test.customer@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("+886 912 345 678");
  await page.getByLabel("Initial login password").fill("SecureTest2026!");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Test Customer", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Team", exact: true })
    .click();
  await page.getByRole("button", { name: "Add team member" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Green");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("taylor@example.com");
  await page.getByLabel("Role / specialty").fill("Wellness coach");
  await page.getByLabel("Initial login password").fill("SecureTest2026!");
  await page
    .getByRole("checkbox", { name: "Signature Massage", exact: true })
    .check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Taylor Green" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("taylor@example.com");
  await page.getByLabel("Password", { exact: true }).fill("SecureTest2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon), Taylor/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Reports" }),
  ).toHaveCount(0);
});
test("customer registration, login, booking and profile", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Casey Rivera");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("casey@example.com");
  await page.getByLabel("Phone number").fill("+886 900 123 456");
  await page.getByLabel("Password", { exact: true }).fill("SecureTest2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My bookings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your next moment of care starts here" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Book an appointment", exact: true })
    .click();
  await page.getByRole("button", { name: /Wellness Consultation/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Choose your provider").selectOption("staff-1");
  await selectFutureDate(page);
  await page.getByRole("button", { name: "10:00 AM", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(page.locator(".confirmation-card .badge")).toHaveText("Pending");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My profile" })
    .click();
  await page
    .getByLabel("Phone number", { exact: true })
    .fill("+886 900 777 888");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Your profile is up to date.",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("casey@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill("SecureTest2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My bookings", exact: true }),
  ).toBeVisible();
});
test("mobile navigation, no horizontal overflow, booking dialog keyboard and screenshot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your calendar" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "New appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("simultaneous tabs cannot double-book a provider", async ({
  page,
  context,
}) => {
  await ready(page);
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: /Good (morning|afternoon|evening), Emmanuel/ }),
  ).toBeVisible();
  const prepare = async (tab: Page, customerId: string) => {
    await tab
      .getByRole("button", { name: "New appointment", exact: true })
      .click();
    await tab.getByRole("button", { name: /Signature Massage/ }).click();
    await tab
      .getByRole("combobox", { name: "Customer", exact: true })
      .selectOption(customerId);
    await tab.getByRole("button", { name: "Continue", exact: true }).click();
    await tab.getByLabel("Choose your provider").selectOption("staff-1");
    await selectFutureDate(tab, 25);
    await tab.getByRole("button", { name: "10:00 AM", exact: true }).click();
    await tab.getByRole("button", { name: "Continue", exact: true }).click();
  };
  await prepare(page, "customer-1");
  await prepare(second, "customer-2");
  await Promise.all([
    page.getByRole("button", { name: "Book appointment", exact: true }).click(),
    second
      .getByRole("button", { name: "Book appointment", exact: true })
      .click(),
  ]);
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("heading", { name: "It’s in the calendar." })
          .count()) +
        (await second
          .getByRole("heading", { name: "It’s in the calendar." })
          .count()),
    )
    .toBe(1);
  const loser = (await page
    .getByRole("heading", { name: "It’s in the calendar." })
    .count())
    ? second
    : page;
  await expect(loser.getByRole("alert")).toContainText("already booked");
  await second.close();
});

test("closed dates, past dates and missing time selections stay unbookable", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "New appointment", exact: true })
    .click();
  await page.getByRole("button", { name: /Signature Massage/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Choose your provider").selectOption("staff-1");
  const sunday = new Date();
  sunday.setDate(sunday.getDate() + 28 + ((7 - sunday.getDay()) % 7));
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  await page.getByLabel("Appointment date").fill(key(sunday));
  await expect(
    page.getByRole("heading", { name: "No available times" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Choose an available time slot",
  );
  await page
    .getByLabel("Appointment date")
    .fill(key(new Date(Date.now() - 86400000 * 2)));
  await expect(
    page.getByRole("heading", { name: "No available times" }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("Appointment date")
      .evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow),
  ).toBe(true);
  await selectFutureDate(page, 25);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Choose an available time slot",
  );
  await expect(
    page.getByRole("heading", { name: "Everything looking good?" }),
  ).toHaveCount(0);
});

test("report totals reconcile with appointment exports and period navigation", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Appointments/ })
    .click();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const appointmentsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const { readFile } = await import("node:fs/promises");
  const appointmentFile = await appointmentsDownload;
  const contents = await readFile((await appointmentFile.path())!, "utf8");
  const rows = contents
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) =>
      line.split('","').map((value) => value.replace(/^"|"$/g, "")),
    );
  const completed = rows.filter((row) => row[7] === "Completed");
  const expectedRevenue = completed.reduce(
    (sum, row) => sum + Number(row[8]),
    0,
  );
  const expectedCurrency = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(expectedRevenue);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Appointment revenue" })
      .locator(".stat-value"),
  ).toHaveText(expectedCurrency);
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Total appointments" })
      .locator(".stat-value"),
  ).toHaveText(String(rows.length));
  const reportDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  const reportFile = await reportDownload;
  const report = await readFile((await reportFile.path())!, "utf8");
  expect(report).toContain(
    `"TOTAL","${rows.length}","${completed.length}","${expectedRevenue}"`,
  );
  await page.getByLabel("Selected date").fill("2026-01-31");
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(page.getByLabel("Selected date")).toHaveValue("2026-02-28");
  await page.getByLabel("Selected date").fill("2035-01-15");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Appointment revenue" })
      .locator(".stat-value"),
  ).toHaveText("₱0");
  await expect(
    page.getByText("No completed appointment revenue for this period."),
  ).toBeVisible();
});

for (const [name, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1040],
] as const) {
  test(`${name}: all page layouts and management dialogs remain usable`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await ready(page);
    for (const [route, heading] of [
      ["Overview", /Good (morning|afternoon|evening), Emmanuel/],
      ["Calendar", "Your calendar"],
      ["Appointments", "Appointments"],
      ["Services", "Our services"],
      ["Team", "Your team"],
      ["Customers", "Your customers"],
      ["Reports", "Reports & insights"],
      ["Settings", "Business settings"],
      ["My profile", "My profile"],
    ] as const) {
      await page.goto(`/#${encodeURIComponent(route)}`);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} ${route} overflows`,
      ).toBe(true);
      if (route === "Overview" || route === "Settings")
        await page.screenshot({
          path: `test-results/${name}-${route.toLowerCase()}.png`,
          fullPage: true,
        });
    }
    await page.goto("/#Team");
    await page
      .getByRole("button", { name: "Manage profile & schedule" })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${name}-staff-dialog.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Your changes have been saved.",
    );
    expect(errors).toEqual([]);
  });
}
