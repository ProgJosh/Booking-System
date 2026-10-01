import { useState, type ReactNode } from "react";
import {
  Plus,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import { dateKey, addDays, money } from "../lib/date";
import { errorMessage } from "../lib/validation";
import {
  canManageProperty,
  type TravelData,
  type Reservation,
  type Property,
  type Room,
  type Promotion,
  type Experience,
} from "../lib/travel";
import { STATUSES, type Database, type User, type Staff } from "../types";
import {
  Badge,
  Empty,
  Field,
  Modal,
  ErrorNotice,
  SubmitButton,
  downloadCSV,
} from "../components/ui";
import { ScheduleEditor } from "./Management";
import { defaultSchedule } from "../data/seed";
export function ReservationList({
  data,
  user,
  onSelect,
  calendar = false,
  initialQuery = "",
}: {
  data: TravelData;
  user: User;
  onSelect: (r: Reservation) => void;
  calendar?: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery),
    [status, setStatus] = useState(""),
    [property, setProperty] = useState(""),
    [date, setDate] = useState(""),
    [month, setMonth] = useState(dateKey().slice(0, 7));
  const rows = data.reservations
    .filter(
      (r) =>
        (!status || r.status === status) &&
        (!property || r.propertyId === property) &&
        (!date || (r.checkIn <= date && r.checkOut > date)) &&
        [r.id, r.guestName, r.email, r.propertyName, r.roomName]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const [year, mon] = month.split("-").map(Number),
    days = new Date(Date.UTC(year, mon, 0)).getUTCDate(),
    pad = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  function shift(delta: number) {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {user.role === "customer"
              ? "The places you are looking forward to"
              : "Every stay, thoughtfully managed"}
          </p>
          <h1>
            {user.role === "customer"
              ? "Your reservations"
              : calendar
                ? "Stay calendar"
                : "Reservations"}
          </h1>
          <p>Demo stays · Dates follow Manila time.</p>
        </div>
        <span className="demo-pill">Local demo</span>
      </div>
      <div className="reservation-filters">
        <Field label="Search reservations">
          <input
            placeholder="Guest, resort, room or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Property">
          <select
            value={property}
            onChange={(e) => setProperty(e.target.value)}
          >
            <option value="">All properties</option>
            {data.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Occupied date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <button
          className="text-btn"
          onClick={() => {
            setQuery("");
            setStatus("");
            setProperty("");
            setDate("");
          }}
        >
          Clear filters
        </button>
      </div>
      {calendar ? (
        <div className="calendar-panel">
          <div className="calendar-controls">
            <button
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <ChevronLeft />
            </button>
            <h2>
              {new Intl.DateTimeFormat("en", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(year, mon - 1, 1)))}
            </h2>
            <button
              className="icon-btn"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="calendar-scroll">
            <div className="stay-calendar">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <strong key={d}>{d}</strong>
              ))}
              {Array.from({ length: pad }, (_, i) => (
                <div className="calendar-day blank" key={"pad" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const d = month + "-" + String(i + 1).padStart(2, "0");
                return (
                  <div
                    className={
                      "calendar-day " + (d === dateKey() ? "today" : "")
                    }
                    key={d}
                  >
                    <span>{i + 1}</span>
                    {rows
                      .filter((r) => r.checkIn <= d && r.checkOut > d)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => onSelect(r)}
                          className={
                            "calendar-reservation " + r.status.toLowerCase()
                          }
                        >
                          <strong>{r.guestName}</strong>
                          <small>
                            {r.propertyName} · {r.status}
                          </small>
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="fine-print">
            Reservations appear on occupied nights; the check-out day is
            available for the next arrival.
          </p>
        </div>
      ) : (
        <>
          <p role="status" className="result-count">
            {rows.length} {rows.length === 1 ? "reservation" : "reservations"}
          </p>
          <div className="reservation-list">
            {rows.map((r) => (
              <article key={r.id} className="reservation-card">
                <img
                  src={
                    data.properties.find((p) => p.id === r.propertyId)?.image ||
                    "/images/room.jpg"
                  }
                  alt="Illustrative destination scenery"
                  loading="lazy"
                  width="180"
                  height="130"
                />
                <div>
                  <p className="eyebrow">{r.id}</p>
                  <h3>{r.propertyName}</h3>
                  <p>
                    {r.roomName} · {r.guests} guests
                  </p>
                  <p>
                    <CalendarDays size={15} /> {r.checkIn} → {r.checkOut} ·{" "}
                    {r.nights} nights
                  </p>
                  {user.role !== "customer" && (
                    <p>
                      {r.guestName} · {r.email}
                    </p>
                  )}
                </div>
                <div className="reservation-card-actions">
                  <Badge status={r.status} />
                  <strong>{money(r.total)}</strong>
                  <button className="btn secondary" onClick={() => onSelect(r)}>
                    View reservation
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!rows.length && (
            <Empty
              title="Room for your next adventure"
              text="No reservations match these filters. Explore stays or clear your search."
            />
          )}
        </>
      )}
    </>
  );
}
type Values = Record<string, string | number | boolean | string[]>;
type Kind =
  | "properties"
  | "rooms"
  | "experiences"
  | "offers"
  | "guests"
  | "team"
  | "settings";
const photos = [
  "/images/island.jpg",
  "/images/coast.jpg",
  "/images/forest.jpg",
  "/images/pool.jpg",
  "/images/room.jpg",
  "/images/dining.jpg",
];
function Editor({
  kind,
  initial,
  db,
  user,
  onClose,
  notify,
}: {
  kind: Kind;
  initial: Values;
  db: Database;
  user: User;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [lists, setLists] = useState<Record<string, string>>({
    amenities: ((initial.amenities as string[]) || []).join(", "),
    blockedDates: ((initial.blockedDates as string[]) || []).join(", "),
    daysOff: ((initial.daysOff as string[]) || []).join(", "),
  });
  const [v, set] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const member = db.staff.find((s) => s.id === initial.id),
    [schedule, setSchedule] = useState(member?.schedule || defaultSchedule());
  const data = db.travel!,
    isStaff = user.role === "staff",
    put = (name: string, value: Values[string]) => set({ ...v, [name]: value });
  const text = (
    key: string,
    label: string,
    type = "text",
    min?: number,
    max?: number,
  ): ReactNode => (
    <Field key={key} label={label}>
      <input
        type={type}
        required={
          !["phone", "notes", "password"].includes(key) ||
          key === "phone" ||
          (key === "password" && !v.id)
        }
        min={type === "number" ? min : undefined}
        max={type === "number" ? max : undefined}
        minLength={type === "password" ? 8 : undefined}
        step={
          type === "number"
            ? key === "price"
              ? ".01"
              : key === "rating"
                ? ".1"
                : "1"
            : undefined
        }
        disabled={
          isStaff &&
          kind === "rooms" &&
          ["name", "price", "capacity"].includes(key)
        }
        value={String(v[key] ?? "")}
        onChange={(e) =>
          put(key, type === "number" ? e.target.valueAsNumber : e.target.value)
        }
      />
    </Field>
  );
  const area = (key: string, label: string, list = false) => (
    <Field
      key={key}
      label={label}
      hint={list ? "Separate values with commas." : undefined}
    >
      <textarea
        rows={3}
        required={!list && key !== "notes"}
        disabled={
          isStaff &&
          kind === "rooms" &&
          ["description", "amenities"].includes(key)
        }
        value={list ? lists[key] || "" : String(v[key] || "")}
        onChange={(e) => {
          if (list) setLists({ ...lists, [key]: e.target.value });
          else put(key, e.target.value);
        }}
      />
    </Field>
  );
  const image = (key = "image") => (
    <Field label="Illustrative image">
      <select
        value={String(v[key])}
        disabled={isStaff}
        onChange={(e) => put(key, e.target.value)}
      >
        {photos.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
    </Field>
  );
  const active = (
    <label className="checkbox-row">
      <input
        type="checkbox"
        checked={Boolean(v.active)}
        onChange={(e) => put("active", e.target.checked)}
      />
      Active for new reservations / account access
    </label>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const clean = { ...v };
    for (const key of ["amenities", "blockedDates", "daysOff"])
      if (Array.isArray(clean[key]))
        clean[key] = (lists[key] || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    try {
      if (kind === "properties")
        await api.saveProperty(clean as unknown as Property);
      if (kind === "rooms") await api.saveRoom(clean as unknown as Room);
      if (kind === "experiences")
        await api.saveExperience(clean as unknown as Experience);
      if (kind === "offers")
        await api.savePromotion(clean as unknown as Promotion);
      if (kind === "guests")
        await api.saveCustomer(
          clean as unknown as Parameters<typeof api.saveCustomer>[0],
        );
      if (kind === "team")
        await api.saveStaff(
          {
            ...clean,
            schedule,
            serviceIds: member?.serviceIds || db.services.map((s) => s.id),
          } as unknown as Staff,
          String(v.password || ""),
        );
      if (kind === "settings")
        await api.saveSettings({
          ...db.settings,
          name: String(v.name),
          email: String(v.email),
          phone: String(v.phone),
          address: String(v.address),
        });
      notify("Changes saved.");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={
        (v.id ? "Edit " : "Add ") +
        {
          properties: "property",
          rooms: "room type",
          experiences: "experience",
          offers: "offer",
          guests: "guest",
          team: "team member",
          settings: "business details",
        }[kind]
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="modal-body">
          <ErrorNotice error={error} />
          <div className="form-grid">
            {[
              "properties",
              "rooms",
              "experiences",
              "guests",
              "team",
              "settings",
            ].includes(kind) &&
              text(
                "name",
                kind === "guests" || kind === "team" ? "Full name" : "Name",
              )}
            {["guests", "team", "settings"].includes(kind) &&
              text("email", "Email address", "email")}
            {["guests", "settings"].includes(kind) &&
              text("phone", "Phone number", "tel")}
            {((kind === "guests" && !v.id) || (kind === "team" && !v.id)) &&
              text("password", "Initial login password", "password")}
            {kind === "team" && (
              <>
                {text("title", "Hospitality role")}
                {area("daysOff", "Days off (YYYY-MM-DD)", true)}
              </>
            )}
            {kind === "settings" && text("address", "Business address")}
            {kind === "properties" && (
              <>
                {text("destination", "Destination")}
                <Field label="Setting">
                  <select
                    value={String(v.kind)}
                    onChange={(e) => put("kind", e.target.value)}
                  >
                    {["Island", "Forest", "Coast"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                {text("address", "Location (sample address)")}
                {text("rating", "Sample rating", "number", 0, 5)}
                {image()}
                {area("description", "Description")}
                {area("policy", "Arrival and cancellation policy")}
                {area("amenities", "Amenities", true)}
                <Field
                  label="Gallery photographs"
                  hint="Select one or more local illustrative photographs."
                >
                  <select
                    multiple
                    value={v.gallery as string[]}
                    onChange={(e) =>
                      put(
                        "gallery",
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                  >
                    {photos.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned property managers">
                  <select
                    multiple
                    value={v.managerIds as string[]}
                    onChange={(e) =>
                      put(
                        "managerIds",
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                  >
                    {db.staff
                      .filter((s) => s.active)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            )}
            {["rooms", "experiences"].includes(kind) && (
              <>
                <Field label="Property">
                  <select
                    required
                    disabled={isStaff || !!v.id}
                    value={String(v.propertyId)}
                    onChange={(e) => put("propertyId", e.target.value)}
                  >
                    {data.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {text(
                  "price",
                  kind === "rooms"
                    ? "Nightly price (PHP)"
                    : "Price per reservation (PHP)",
                  "number",
                  kind === "rooms" ? 100 : 0,
                  100000,
                )}
                {image()}
                {area("description", "Description")}
              </>
            )}
            {kind === "rooms" && (
              <>
                {text("capacity", "Maximum guests", "number", 1, 12)}
                {text("inventory", "Rooms of this type", "number", 1, 100)}
                {area("amenities", "Room amenities", true)}
                {area("blockedDates", "Closed nights (YYYY-MM-DD)", true)}
                <p className="fine-print">
                  Closures apply to occupied nights. Inventory changes that
                  invalidate upcoming reservations are rejected.
                </p>
              </>
            )}
            {kind === "offers" && (
              <>
                {text("code", "Offer code")}
                {text("title", "Offer title")}
                {text("percent", "Room discount (%)", "number", 1, 50)}
                {text("endDate", "Valid through", "date")}
                {area("description", "Offer description")}
              </>
            )}
            {kind === "guests" && area("notes", "Guest notes")}
          </div>
          {kind === "team" && (
            <>
              <h3>Guest service desk schedule</h3>
              <p>
                Manila time. Room availability is managed separately using
                nightly inventory.
              </p>
              <ScheduleEditor value={schedule} onChange={setSchedule} />
            </>
          )}
          {!["guests", "settings"].includes(kind) && active}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            disabled={busy}
            className="btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <SubmitButton busy={busy}>Save changes</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
export function TravelWorkspace({
  db,
  user,
  tab,
  onTab,
  onSelect,
  notify,
  onExplore,
}: {
  db: Database;
  user: User;
  tab: string;
  onTab: (t: string) => void;
  onSelect: (r: Reservation) => void;
  notify: (s: string) => void;
  onExplore: () => void;
}) {
  const data = db.travel!,
    [edit, setEdit] = useState<{ kind: Kind; value: Values } | null>(null),
    [query, setQuery] = useState(""),
    [guestFilter, setGuestFilter] = useState(""),
    [period, setPeriod] = useState("month"),
    [from, setFrom] = useState(addDays(dateKey(), -30)),
    [to, setTo] = useState(dateKey());
  const admin = user.role === "admin",
    properties = data.properties.filter((p) => canManageProperty(user, p)),
    today = dateKey();
  const tabs = [
    "overview",
    "reservations",
    "calendar",
    "properties",
    "rooms",
    "experiences",
    ...(admin
      ? ["guests", "team", "offers", "reports", "settings"]
      : ["reports"]),
  ];
  const safeTab = tabs.includes(tab) ? tab : "overview";
  function open(kind: Kind, value: object) {
    setEdit({ kind, value: structuredClone(value) as Values });
  }
  const periodStart =
    period === "day"
      ? today
      : period === "week"
        ? addDays(today, -6)
        : today.slice(0, 7) + "-01";
  const upcoming = data.reservations.filter(
    (r) => ["Pending", "Confirmed"].includes(r.status) && r.checkOut > today,
  );
  const completed = data.reservations.filter((r) => r.status === "Completed");
  const stats = [
    {
      name: "Arrivals this " + period,
      value: data.reservations.filter(
        (r) =>
          r.checkIn >= periodStart &&
          r.checkIn <= today &&
          !["Cancelled", "No-show"].includes(r.status),
      ).length,
    },
    {
      name: "Requests to confirm",
      value: data.reservations.filter((r) => r.status === "Pending").length,
    },
    {
      name: "Completed stay value",
      value: money(
        completed
          .filter((r) => r.checkOut >= periodStart && r.checkOut <= today)
          .reduce((s, r) => s + r.total, 0),
      ),
    },
    {
      name: "Upcoming room nights",
      value: upcoming.reduce((s, r) => s + r.nights, 0),
    },
  ];
  const title = safeTab[0].toUpperCase() + safeTab.slice(1);
  let collection: {
    id: string;
    name: string;
    detail: string;
    value: object;
    kind: Kind;
    image?: string;
  }[] = [];
  if (safeTab === "properties")
    collection = properties.map((p) => ({
      id: p.id,
      name: p.name,
      detail: p.destination + " · " + (p.active ? "Active" : "Archived"),
      image: p.image,
      value: p,
      kind: "properties",
    }));
  if (safeTab === "rooms")
    collection = data.rooms
      .filter((r) => properties.some((p) => p.id === r.propertyId))
      .map((r) => ({
        id: r.id,
        name: r.name,
        detail:
          data.properties.find((p) => p.id === r.propertyId)?.name +
          " · " +
          money(r.price) +
          "/night · " +
          r.inventory +
          " rooms · " +
          r.capacity +
          " guests · " +
          (r.active ? "Active" : "Inactive"),
        image: r.image,
        value: r,
        kind: "rooms",
      }));
  if (safeTab === "experiences")
    collection = data.experiences
      .filter((e) => properties.some((p) => p.id === e.propertyId))
      .map((e) => ({
        id: e.id,
        name: e.name,
        detail:
          data.properties.find((p) => p.id === e.propertyId)?.name +
          " · " +
          money(e.price) +
          " · " +
          (e.active ? "Active" : "Inactive"),
        image: e.image,
        value: e,
        kind: "experiences",
      }));
  if (safeTab === "offers")
    collection = data.promotions.map((p) => ({
      id: p.id,
      name: p.title,
      detail:
        p.code +
        " · " +
        p.percent +
        "% · Through " +
        p.endDate +
        " · " +
        (p.active ? "Active" : "Inactive"),
      value: p,
      kind: "offers",
    }));
  if (safeTab === "guests")
    collection = db.users
      .filter((u) => u.role === "customer")
      .map((u) => ({
        id: u.id,
        name: u.name,
        detail:
          u.email +
          " · " +
          u.phone +
          " · " +
          data.reservations.filter((r) => r.customerId === u.id).length +
          " reservations",
        value: {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          notes: u.notes || "",
        },
        kind: "guests",
      }));
  if (safeTab === "team")
    collection = db.staff.map((s) => ({
      id: s.id,
      name: s.name,
      detail:
        s.email +
        " · " +
        properties
          .filter((p) => p.managerIds.includes(s.id))
          .map((p) => p.name)
          .join(", ") +
        " · " +
        (s.active ? "Active" : "Inactive"),
      value: {
        id: s.id,
        name: s.name,
        email: s.email,
        title: s.title,
        active: s.active,
        color: s.color,
        daysOff: s.daysOff,
      },
      kind: "team",
    }));
  function add() {
    const p = properties[0]?.id || "";
    const defaults: Partial<Record<Kind, Values>> = {
      properties: {
        id: "",
        name: "",
        destination: "",
        kind: "Island",
        description: "",
        image: photos[0],
        gallery: photos.slice(0, 3),
        amenities: ["Wi-Fi"],
        address: "",
        rating: 4,
        active: true,
        managerIds: [],
        policy:
          "Check-in from 2 PM; check-out by 11 AM. Cancel before check-in. Demo property only.",
      },
      rooms: {
        id: "",
        propertyId: p,
        name: "",
        description: "",
        image: "/images/room.jpg",
        price: 5000,
        capacity: 2,
        inventory: 2,
        active: true,
        blockedDates: [],
        amenities: ["King bed", "Wi-Fi"],
      },
      experiences: {
        id: "",
        propertyId: p,
        name: "",
        description: "",
        image: "/images/dining.jpg",
        price: 1200,
        active: true,
      },
      offers: {
        id: "",
        code: "",
        title: "",
        description: "",
        percent: 10,
        endDate: addDays(today, 60),
        active: true,
      },
      guests: {
        id: "",
        name: "",
        email: "",
        phone: "",
        password: "",
        notes: "",
      },
      team: {
        id: "",
        name: "",
        email: "",
        title: "Guest experience host",
        active: true,
        color: "sage",
        daysOff: [],
        password: "",
      },
    };
    const value = defaults[safeTab as Kind];
    if (value) setEdit({ kind: safeTab as Kind, value });
  }
  const reportRows = data.reservations.filter(
      (r) => r.checkOut >= from && r.checkOut <= to,
    ),
    validRange = from <= to;
  return (
    <main className="travel-workspace travel-container">
      <div className="workspace-intro">
        <span className="eyebrow">
          {admin ? "Property administration" : "Guest experience desk"} · Alder
          & Tide
        </span>
        <span className="demo-pill">
          {user.name} · {user.role}
        </span>
      </div>
      <nav className="workspace-tabs" aria-label="Management areas">
        {tabs.map((t) => (
          <button
            key={t}
            className={t === safeTab ? "active" : ""}
            aria-current={t === safeTab ? "page" : undefined}
            onClick={() => {
              setQuery("");
              setGuestFilter("");
              onTab(t);
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {safeTab === "overview" && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Hospitality begins with a thoughtful plan
              </p>
              <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
              <p>Here is what is happening across your properties.</p>
            </div>
            <button className="btn primary" onClick={onExplore}>
              Create reservation
              <Plus size={17} />
            </button>
          </div>
          <Field label="Dashboard period">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="day">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
            </select>
          </Field>
          <div className="travel-stats">
            {stats.map((s) => (
              <article key={s.name}>
                <p>{s.name}</p>
                <strong>{s.value}</strong>
              </article>
            ))}
          </div>
          <div className="admin-panel">
            <div className="section-heading">
              <h2>Next arrivals</h2>
              <button
                className="text-btn"
                onClick={() => onTab("reservations")}
              >
                All reservations
                <ArrowUpRight size={17} />
              </button>
            </div>
            {upcoming
              .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
              .slice(0, 5)
              .map((r) => (
                <button
                  className="arrival-row"
                  key={r.id}
                  onClick={() => onSelect(r)}
                >
                  <span>
                    <strong>{r.guestName}</strong>
                    <small>
                      {r.propertyName} · {r.roomName}
                    </small>
                  </span>
                  <span>{r.checkIn}</span>
                  <Badge status={r.status} />
                </button>
              ))}
            {!upcoming.length && (
              <Empty text="No upcoming arrivals for your properties." />
            )}
          </div>
          <p className="fine-print">
            Completed stay value is a demo revenue proxy, not a record of
            collected payments.
          </p>
        </>
      )}
      {["reservations", "calendar"].includes(safeTab) && (
        <ReservationList
          data={data}
          user={user}
          onSelect={onSelect}
          calendar={safeTab === "calendar"}
          initialQuery={guestFilter}
        />
      )}
      {[
        "properties",
        "rooms",
        "experiences",
        "offers",
        "guests",
        "team",
      ].includes(safeTab) && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">The details that make a great stay</p>
              <h1>{title}</h1>
            </div>
            {admin && (
              <button className="btn primary" onClick={add}>
                Add{" "}
                {
                  (
                    {
                      properties: "property",
                      rooms: "room type",
                      experiences: "experience",
                      offers: "offer",
                      guests: "guest",
                      team: "team member",
                    } as Record<string, string>
                  )[safeTab]
                }
                <Plus size={17} />
              </button>
            )}
          </div>
          <Field label={"Search " + safeTab}>
            <input
              value={query}
              placeholder="Search by name or details"
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <div className="management-grid">
            {collection
              .filter((c) =>
                (c.name + c.detail).toLowerCase().includes(query.toLowerCase()),
              )
              .map((c) => (
                <article key={c.id} className="management-card">
                  {c.image && (
                    <img
                      src={c.image}
                      alt={"Illustrative image for " + c.name}
                      width="1000"
                      height="700"
                      loading="lazy"
                    />
                  )}
                  <div>
                    <h3>{c.name}</h3>
                    <p>{c.detail}</p>
                    {(admin || safeTab === "rooms") && (
                      <button
                        className="btn secondary"
                        aria-label={"Edit " + c.name + " " + c.id}
                        onClick={() => open(c.kind, c.value)}
                      >
                        {safeTab === "rooms" && !admin
                          ? "Manage inventory"
                          : "Edit details"}
                      </button>
                    )}
                    {safeTab === "guests" && (
                      <button
                        className="text-btn"
                        onClick={() => {
                          setQuery("");
                          setGuestFilter(
                            String((c.value as { email: string }).email),
                          );
                          onTab("reservations");
                        }}
                      >
                        Browse guest reservations
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {!collection.some((c) =>
            (c.name + c.detail).toLowerCase().includes(query.toLowerCase()),
          ) && (
            <Empty text="No items match your search. Try another name or clear the search." />
          )}
        </>
      )}
      {safeTab === "reports" && (
        <>
          <p className="eyebrow">A clear view of your collection</p>
          <h1>Stay & revenue reports</h1>
          <p>
            Revenue reflects completed demo stays by check-out date. No payments
            have been collected.
          </p>
          <div className="report-controls">
            <Field label="From check-out date">
              <input
                required
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To check-out date">
              <input
                required
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <button
              className="btn secondary"
              disabled={!validRange}
              onClick={() =>
                downloadCSV("alder-tide-reservations.csv", [
                  [
                    "Reference",
                    "Guest",
                    "Property",
                    "Room",
                    "Check-in",
                    "Check-out",
                    "Nights",
                    "Status",
                    "Total PHP",
                    "Payment preference",
                  ],
                  ...reportRows.map((r) => [
                    r.id,
                    r.guestName,
                    r.propertyName,
                    r.roomName,
                    r.checkIn,
                    r.checkOut,
                    r.nights,
                    r.status,
                    r.total,
                    r.paymentMethod,
                  ]),
                ])
              }
            >
              Export reservations CSV
            </button>
          </div>
          {!validRange && (
            <ErrorNotice error="The end date must be on or after the start date." />
          )}
          <div className="travel-stats">
            <article>
              <p>Reservations</p>
              <strong>{validRange ? reportRows.length : 0}</strong>
            </article>
            <article>
              <p>Completed stay value</p>
              <strong>
                {money(
                  validRange
                    ? reportRows
                        .filter((r) => r.status === "Completed")
                        .reduce((s, r) => s + r.total, 0)
                    : 0,
                )}
              </strong>
            </article>
            <article>
              <p>Completed nights</p>
              <strong>
                {validRange
                  ? reportRows
                      .filter((r) => r.status === "Completed")
                      .reduce((s, r) => s + r.nights, 0)
                  : 0}
              </strong>
            </article>
            <article>
              <p>Cancelled stays</p>
              <strong>
                {validRange
                  ? reportRows.filter((r) => r.status === "Cancelled").length
                  : 0}
              </strong>
            </article>
          </div>
          <div className="table-scroll">
            <table className="travel-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Reservations</th>
                  <th>Completed nights</th>
                  <th>Completed value</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => {
                  const rs = validRange
                      ? reportRows.filter((r) => r.propertyId === p.id)
                      : [],
                    cs = rs.filter((r) => r.status === "Completed");
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{rs.length}</td>
                      <td>{cs.reduce((s, r) => s + r.nights, 0)}</td>
                      <td>{money(cs.reduce((s, r) => s + r.total, 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {validRange && !reportRows.length && (
            <Empty text="No reservations have check-out dates in this reporting period." />
          )}
        </>
      )}
      {safeTab === "settings" && (
        <div className="admin-panel">
          <p className="eyebrow">Your guest-facing contact information</p>
          <h1>Business details</h1>
          <h3>{db.settings.name}</h3>
          <p>
            {db.settings.email}
            <br />
            {db.settings.phone}
            <br />
            {db.settings.address}
          </p>
          <p>Time zone: Asia/Manila · Currency: PHP</p>
          <button
            className="btn primary"
            onClick={() =>
              open("settings", {
                id: "settings",
                name: db.settings.name,
                email: db.settings.email,
                phone: db.settings.phone,
                address: db.settings.address,
              })
            }
          >
            Edit business details
          </button>
          <h3>Notification-ready activity</h3>
          <p>
            {data.events.length} local reservation events queued. No email or
            SMS provider is connected.
          </p>
          <p className="fine-print">
            A backend is required for shared inventory, production
            authentication, and notification delivery. This browser stores all
            demo changes.
          </p>
        </div>
      )}
      {edit && (
        <Editor
          key={edit.kind + String(edit.value.id)}
          kind={edit.kind}
          initial={edit.value}
          db={db}
          user={user}
          notify={notify}
          onClose={() => setEdit(null)}
        />
      )}
    </main>
  );
}
