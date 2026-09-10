# Morrow — Booking & Appointment Management

A React + TypeScript + Vite + Tailwind CSS application for a service business. The existing project structure and visual design have been preserved. This project runs in **persistent local demo mode** without backend credentials.

## Run locally

Prerequisite: Node.js 24 LTS and npm (verified with Node 24.14.0).

```powershell
cd 'C:\Personal Project\Booking System'
# Only needed on a new checkout or if node_modules is missing:
npm ci
npm run dev -- --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/**. Use the same origin each time: `localhost` and `127.0.0.1` have separate browser storage.

```powershell
npm run build        # Strict TypeScript check and production bundle in dist/
npm run preview      # Serve the production bundle locally
npm test             # Domain, calendar, validation, and local API regression tests
npm run test:e2e      # Real Chromium browser workflow and layout tests
```

The browser suite uses an installed Google Chrome through Playwright's `chrome` channel. It starts the development server if required and reuses one already running on port 5173. On a machine without Chrome, install Chrome or change the Playwright channel to an installed compatible browser. Test contexts are isolated from your normal browser data. Failure traces and layout screenshots are stored in `test-results/`.

## Demo access

On first launch the application opens the admin demo workspace. Sign out beside the profile at the bottom of the sidebar to access the login and registration screen. Quick demo buttons are available there.

| Role                     | Email                       | Password      |
| ------------------------ | --------------------------- | ------------- |
| Administrator            | `admin@morrow.demo`         | `Morrow2026!` |
| Staff — Olivia Chen      | `olivia@morrow.demo`        | `Morrow2026!` |
| Customer — Emma Thompson | `emma.thompson@example.com` | `Morrow2026!` |

New customers register with their own password. Administrators create customer and staff accounts with an initial password. Users can change their password in My profile. If you change a demo account's password, its quick demo button no longer uses the correct password; use the normal login form.

## Included features

- Registration, login, logout, password changes, and persistent customer profiles.
- Admin, staff, and customer views with role and ownership checks in the service layer.
- Services with descriptions, 15-minute duration increments, prices in PHP, active state, and calendar colors.
- Staff profiles, linked login accounts, assigned services, weekly schedules, and days off.
- Business contact details, opening hours, and individual closure dates.
- A three-step booking flow with available slots, notes, a review step, and confirmation.
- Automatic prevention of provider and customer overlaps; adjacent appointments remain valid.
- Pending, Confirmed, Completed, Cancelled, and No-show statuses.
- Rescheduling, cancellation, persistent history, and queued notification events.
- Dashboard, day/week/month calendars, list views, pagination, search, and service/provider/status/date filters.
- Customer directory, contact details, notes, and appointment history.
- Daily, weekly, and monthly reports, service revenue breakdowns, appointment outcomes, and CSV exports.
- Responsive desktop, tablet, and mobile screens; loading, empty, validation-error, save-error, and success states.
- Modal keyboard focus containment, Escape dismissal, and reduced-motion support.

## Permissions

| Action                                            | Admin                 | Staff                                     | Customer                  |
| ------------------------------------------------- | --------------------- | ----------------------------------------- | ------------------------- |
| See appointments                                  | All                   | Own provider appointments                 | Own bookings              |
| Create bookings                                   | Any customer/provider | Own provider, existing assigned customers | Self                      |
| Confirm / complete / mark no-show                 | Yes                   | Own appointments                          | No                        |
| Reschedule / cancel                               | Yes                   | Own appointments                          | Own upcoming appointments |
| Manage services, staff, customers, business hours | Yes                   | No                                        | No                        |
| View reports                                      | All studio activity   | Own dashboard summaries                   | No                        |
| Edit personal profile / password                  | Yes                   | Yes                                       | Yes                       |

A newly created staff member has no assigned customers until an administrator books their first customer appointment. Customer registration always creates a customer role; it cannot create an administrator.

## Booking rules and time storage

- Business timezone is fixed to **Asia/Taipei (UTC+08:00)**. Date-only values use `YYYY-MM-DD`, schedule times use `HH:mm`, and appointments store UTC ISO timestamps.
- Slots begin on 15-minute boundaries. The whole appointment must fit both business and staff opening hours, and must not fall on a closure or day off.
- New bookings must start in the future. Pending and Confirmed appointments reserve availability. Completed appointments retain their historical interval; Cancelled and No-show appointments release it.
- Provider and customer overlaps are both rejected using half-open intervals: `[start, end)`. A booking can start exactly when the previous one ends.
- Availability is checked again inside the save transaction. Web Locks serialize writes across tabs using the same origin. A promise queue is the fallback in browsers without Web Locks; that fallback only serializes operations in the current tab.
- Upcoming active appointments can be moved or cancelled. Customers cannot cancel an appointment that has started. Completion is available only after the end time; No-show is available only after the start time. Terminal statuses cannot be reopened.
- Existing appointments keep their booked service name, price, and duration when a service is edited. Rescheduling also preserves the original price and duration. Deactivation prevents new bookings but preserves historical records and permits existing appointments to be moved.
- Staff deactivation, removal of an assigned service, schedule reductions, or business closures that conflict with upcoming appointments are rejected until those appointments are rescheduled or cancelled.
- Revenue counts the booked value of **Completed** appointments only. It is not a payment ledger. Pending, Confirmed, Cancelled, and No-show values do not count as earned revenue. Cents are preserved when displaying amounts.

## Project structure

```text
src/
  App.tsx                 Workspace shell, role-aware navigation, session state
  types.ts                Shared domain contracts
  components/
    BookingFlow.tsx       Booking wizard, confirmation, appointment actions
    ui.tsx                Shared fields, modal, badges, avatars, states, CSV export
  data/seed.ts            Realistic services, staff, customers, relative-date bookings
  lib/
    api.ts                Async local service layer, authentication, locked persistence
    domain.ts             Booking rules, permissions, admin mutations, notification outbox
    date.ts               Taipei/UTC conversions, periods, month navigation, currency
    calendar.ts           Event column assignment and visible calendar hours
    validation.ts         Zod schemas and readable form errors
    *.test.ts             Rule, regression, and API tests
  pages/
    Auth.tsx              Login and registration
    Dashboard.tsx         Studio overview and shared appointment table
    Appointments.tsx      Calendar/list/customer history, filters, exports
    Management.tsx        Services, team, customers, business settings, profile
    Reports.tsx           Appointment and revenue reports
  styles.css              Existing visual system and responsive rules
 tests/e2e/               Browser workflow and responsive-layout tests
```

## Persistence and future backend integration

The versioned database is stored under `morrow.database.v1`; the current local session is under `morrow.session.v1`. Data persists across refreshes, and storage events update other tabs. Initial seeding is also locked so two tabs cannot overwrite each other's first-run data. Existing saved data is not reseeded or reset by code updates.

`src/lib/api.ts` is the integration boundary. Replace its local read/write and authentication methods with HTTP calls while keeping the typed UI contracts. Move authorization and validation to the server, and revalidate booking availability inside a database transaction. Use database constraints or locks to prevent overlapping bookings across devices and simultaneous requests.

Booking creation, rescheduling, and status changes enqueue typed notification events in the same saved database update. Events include an ID, recipient, booking reference, event type, message, channel, and queued delivery state. A future server worker can resolve contact information, invoke an email/SMS provider, and record delivery attempts and idempotency using the event ID. This demo does not send any messages, and no provider credentials are embedded in the browser.

## Limits of local demo mode

- Authentication and authorization demonstrate workflows; they are not a production security boundary. Anyone with browser storage access can change the local database. New passwords use salted PBKDF2-SHA-256; seeded demo accounts intentionally share demo credentials. Use sample information only.
- Data and sessions belong to one browser origin. Tabs share the signed-in account. There is no server synchronization, password recovery, email verification, or cross-device concurrency protection.
- Email/SMS delivery is queued only. Payments, taxes, refunds, and accounting reconciliation are not implemented.
- The business timezone and currency are fixed to Taipei and PHP. Overnight shifts are not supported; opening must precede closing within the same calendar day.
- Clearing site storage removes this browser's demo records. Export useful reports before clearing data. No automatic reset or destructive migration is performed.

## Manual acceptance checks

1. Open the app in your normal browser and use each of the three demo roles. Confirm the staff and customer views show only their allowed appointments and actions.
2. Register a sample customer, book a service, sign out, and sign back in. Confirm the booking appears in My bookings with Pending status.
3. As admin, confirm the request. Try booking the same provider/time from two tabs, then reschedule and cancel the original appointment. Confirm conflicts are rejected and released slots can be booked.
4. Change staff hours or add a closure that conflicts with an upcoming booking. Confirm the change is rejected without losing the appointment.
5. Edit a service price and duration, then open and reschedule an earlier booking. Confirm it retains its original price and duration.
6. Compare a completed appointment with the corresponding daily/monthly report and downloaded CSV. Confirm cancelled appointments do not contribute revenue.
7. Check the app on your physical phone/tablet, including native date/time pickers, on-screen keyboard, horizontal calendar/table scrolling, and modal scrolling. Browser viewport checks do not replace testing your particular device and browser.
8. Review the sample branding, actual services, prices, opening hours, and cancellation policy before replacing demo data. Connect a secured backend and message provider before any production use.
