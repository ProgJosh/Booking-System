# Alder & Tide — resort stays and guest reservations

A premium Philippine travel booking demo built on the existing Wellora React + TypeScript + Vite + Tailwind project. The existing dependencies, account API, browser persistence, and Cloudflare static Worker configuration are retained. No payment is collected and no real room is reserved.

## Run locally

Use the existing Node/npm environment (Node 24 was used for development).

```powershell
cd 'C:\Personal Project\Booking System'
# Only on a fresh checkout or when node_modules is missing:
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173/#home. The homepage is public; sign-in is needed to reserve. Use the same origin consistently: localhost, 127.0.0.1, and different ports each have separate browser data. If changes seem missing, check that the server was started in this folder and refresh the browser.

```powershell
npm test           # Travel + retained appointment domain/API tests
npm run test:e2e   # Real Chrome workflows and responsive screenshots
npm run build      # Strict TypeScript check, then Vite production build
npm run preview    # Serve dist locally
```

There is no ESLint script or configuration in this project; the build performs strict TypeScript checks, and Prettier can check the new source files. Dependencies were already installed; no installation or dependency change was required for the redesign.

Playwright uses installed Google Chrome via the chrome channel and starts Vite on port 5173 when needed. Its browser contexts are isolated from your normal browser profile. Screenshots/traces are saved in test-results/. Install Chrome or configure an available Playwright browser on another machine.

## Demo accounts

All unchanged seed accounts use password **Morrow2026!**:

| Role          | Email                          | Access                                                                    |
| ------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Administrator | admin@BookSync.demo            | All properties, reservations, guests, team, promotions, reports, settings |
| Staff         | emmanuel.staff@Wellora.demo    | Assigned properties, nightly inventory, reservations and scoped reports   |
| Guest         | emmanuel.josh.velo@example.com | Own reservations and profile                                              |

Existing credential addresses are intentionally preserved so saved users can still sign in. New guest accounts and staff accounts use their own passwords. An administrator creates team accounts and assigns property managers in the property's editor. An unassigned staff member has no property management access. Team service-desk schedules are retained; room availability is governed by nightly room inventory and room closure dates.

## Pages and features

- #home: destination photography, availability search, featured stays, destination collections, experiences, offers, illustrative reviews, help and footer.
- #stays: destination/date/guest search; setting, budget and amenity filters; recommended or price sorting.
- #property/palawan (also siargao, benguet, bohol): gallery, amenities, sample location, policies, room prices, availability and optional experiences.
- #account: login/registration and role demo access.
- #trips and #profile: account reservations, reservation details, cancellation, rescheduling and account contact/password updates.
- #manage/overview: daily, rolling seven-day and monthly arrivals, pending requests, completed stay value and upcoming room nights.
- Management tabs: reservations, occupied-night calendar, properties, rooms, experiences, guests, team, offers, reports and business details. Permissions are checked in the API/domain layer as well as the UI.

Motion uses CSS transitions and IntersectionObserver, with no new animation library. Scroll reveals, card hovers, gallery and booking transitions are brief. Reduced-motion preferences disable animation and smooth scrolling. Forms have explicit labels, keyboard focus states and accessible modal focus traps.

## Reservation rules

Dates are YYYY-MM-DD calendar days in Asia/Manila. Creation/event timestamps are ISO UTC. Check-in is from 2 PM and check-out by 11 AM; inventory is calculated by occupied nights [check-in, check-out). A checkout frees the room for another arrival on the same day.

A reservation covers one room for 1–30 nights, with all adults and children counted against capacity. The domain rejects past/invalid dates, reversed dates, excess guests, closed nights, inactive rooms/properties, expired offers and incompatible experiences. Inventory is checked for each night and writes are serialized using the existing browser coordination lock to prevent competing requests taking the last room.

Guest requests are Pending; staff/admin requests are Confirmed. Authorized staff/admin may confirm requests, complete stays after checkout, cancel, or mark no-show after check-in. Guests may change dates or cancel their own Pending/Confirmed stays before the check-in day. A failed reschedule leaves the original intact. Rescheduling retains the nightly rate and status. Cancellation/no-show releases inventory; history is retained. Inventory reductions, closures and archiving that conflict with upcoming reservations are rejected.

Offers apply to the room subtotal. Experiences are charged once per reservation. Prices are PHP and include fictional demo taxes, with no additional fees. Reservation snapshots keep booked property/room names, room rates, experience prices and totals for history/reporting.

GCash, Maya, MariBank Philippines, GoTyme Bank, UnionBank, Maya Bank, BPI Mobile App and cash at property are **saved payment preferences only**. Wordmark-style UI identifiers do not imply bank affiliation. No bank account credentials, references, proof, redirect or payment processing is implemented. The legacy internal cash value is retained for data compatibility; the travel UI labels it Cash at property.

Reports use checkout dates. Completed stay value is a revenue proxy, not evidence of collected payments. CSV export includes filtered reservations and protects spreadsheet formula cells.

## Existing data and migration

Storage keys remain morrow.database.v1 and morrow.session.v1. On first initialization the travel collection is added as Database.travel without replacing legacy appointment data, users, schedules or credentials. Untouched default business branding and demo hospitality roles are adapted; customized contact details are preserved. Fresh storage opens the public homepage without auto-signing in.

The original appointment modules and their regression tests remain in src/ for compatibility, but the active navigation uses the travel pages. Legacy appointments are not converted into overnight reservations and are not included in stay reports. Do not clear normal browser storage to apply the redesign. For a clean demo, use a separate browser profile.

The travel API in src/lib/api.ts is the adapter boundary for a future backend. Domain validation/inventory lives in src/lib/travel.ts; local fixtures in src/data/travelSeed.ts; public/auth/admin views in src/pages/Travel*.tsx; reusable booking dialogs in src/components/StayBooking.tsx. Reservation events queue locally with delivery=queued, ready to connect to an email/SMS dispatcher.

## Production and Cloudflare

```powershell
npm run build
npx wrangler deploy --dry-run   # Validate/bundle locally; does not deploy
# Only when you explicitly intend to publish:
npm run deploy
```

wrangler.jsonc retains Worker name booking-system, compatibility date 2026-09-10, ./dist assets, and single-page fallback. Do not put credentials in the repository. No deployment was performed as part of this redesign.

Before accepting real guests, replace the browser adapter with a backend that enforces authentication, role ownership, transactional shared room inventory and secure sessions. Connect an email/SMS service for delivery; queued events currently send nothing. A payment provider would require a separate explicitly authorized integration; this demo does not collect money. Browser role checks and password hashes are useful for demonstration, not a production security boundary.

## Imagery and sample content

All property identities, sample locations, rates, reservations, ratings and review stories are fictional. Photographs are atmosphere references, not evidence of real listed resort facilities. Optimized JPEG assets are stored locally, so the app does not depend on external image loading during use. Photos were sourced from Unsplash:

- hero: https://images.unsplash.com/photo-1571896349842-33c89424de2d
- island: https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86
- coast: https://images.unsplash.com/photo-1519046904884-53103b34b206
- forest: https://images.unsplash.com/photo-1448375240586-882707db888b
- room: https://images.unsplash.com/photo-1611892440504-42a792e24d32
- pool: https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7
- dining: https://images.unsplash.com/photo-1414235077428-338989a2e8c0

Hero loading is prioritized; supporting imagery is lazy-loaded with explicit dimensions. Replace stock imagery and illustrative ratings with verified property assets before publishing a real catalog.

## Manual acceptance checks

1. Open the homepage in your regular Brave browser at your usual zoom. Search dates/guests and inspect a property gallery on desktop and phone.
2. Register with sample details, choose experiences and a valid offer, select a bank preference and submit. Verify the pending confirmation, then refresh My stays.
3. Change dates, confirm the retained rate, and cancel. Try a past date, an invalid offer and an unavailable night.
4. Sign in as admin, create a room type or offer, edit guest/team details, assign a manager, and confirm a pending stay. Check calendar and CSV reports.
5. Sign in as staff and verify only assigned properties can be managed. Check reduced-motion/keyboard navigation and confirm no money or notification is sent.

Automated tests cover these domain rules and key Chrome workflows; your specific Brave settings, extensions, OS zoom, and production services still need acceptance testing.
