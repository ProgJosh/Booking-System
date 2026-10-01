import { errorMessage } from "../lib/validation";
import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, Banknote } from "lucide-react";
import { Modal, Field, ErrorNotice, SubmitButton, Badge } from "./ui";
import { api } from "../lib/api";
import { dateKey, addDays, money } from "../lib/date";
import {
  PAYMENT_METHODS,
  type Database,
  type User,
  type PaymentMethod,
  type Status,
} from "../types";
import type {
  TravelData,
  Room,
  StaySearch,
  Reservation,
  ReservationInput,
} from "../lib/travel";
const paymentName = (p: PaymentMethod) =>
  p === "Cash at studio" ? "Cash at property" : p;
function PaymentIcon({ method }: { method: PaymentMethod }) {
  const marks: Record<PaymentMethod, string> = {
    GCash: "G",
    Maya: "maya",
    "MariBank Philippines": "Mari",
    "GoTyme Bank": "goTyme",
    UnionBank: "UB",
    "Maya Bank": "maya",
    "BPI Mobile App": "BPI",
    "Cash at studio": "",
  };
  return (
    <span
      className={"payment-brand brand-" + PAYMENT_METHODS.indexOf(method)}
      aria-hidden="true"
    >
      {marks[method] || <Banknote size={23} />}
    </span>
  );
}
export function StayBooking({
  data,
  db,
  user,
  room,
  search,
  existing,
  onClose,
}: {
  data: TravelData;
  db: Database;
  user: User;
  room: Room;
  search: StaySearch;
  existing?: Reservation;
  onClose: () => void;
}) {
  const guest =
    user.role === "customer"
      ? user
      : db.users.find((u) => u.id === existing?.customerId) ||
        db.users.find((u) => u.role === "customer");
  const [input, setInput] = useState<ReservationInput>({
    customerId: existing?.customerId || guest?.id || "",
    roomId: room.id,
    checkIn: existing?.checkIn || search.checkIn,
    checkOut: existing?.checkOut || search.checkOut,
    guests: existing?.guests || search.guests,
    guestName: existing?.guestName || guest?.name || "",
    email: existing?.email || guest?.email || "",
    phone: existing?.phone || guest?.phone || "",
    paymentMethod: existing?.paymentMethod || "GCash",
    promotionCode: existing?.promotionCode || "",
    experienceIds: existing?.experienceIds || [],
    notes: existing?.notes || "",
  });
  const [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Reservation | null>(null);
  const p = data.properties.find((p) => p.id === room.propertyId)!;
  let summary: ReturnType<typeof api.preview> | undefined;
  try {
    summary = api.preview(input, existing?.id);
  } catch {
    /* Show validation on continue. */
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      api.preview(input, existing?.id);
      if (step < 2) {
        setStep(step + 1);
        return;
      }
      setBusy(true);
      setResult(await api.reserve(input, existing?.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <Modal
        title={
          existing ? "Your dates are updated." : "Your escape is taking shape."
        }
        subtitle="Demo reservation saved. No real room or payment has been booked."
        onClose={onClose}
      >
        <div className="reservation-success">
          <CheckCircle2 size={48} />
          <p className="eyebrow">{result.id}</p>
          <h3>{result.propertyName}</h3>
          <Badge status={result.status} />
          <p>
            {result.roomName} · {result.guests} guests
          </p>
          <p>
            {result.checkIn} → {result.checkOut} · {result.nights} nights ·
            Manila time
          </p>
          <strong>{money(result.total)}</strong>
          <p>{paymentName(result.paymentMethod)} · Payment preference only</p>
          <p className="fine-print">
            The request is saved in this browser. An event is queued for future
            email integration; no message is sent.
          </p>
          <button className="btn primary" onClick={onClose}>
            View my reservations
            <ArrowRight size={17} />
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      wide
      title={existing ? "Change your stay dates" : "Make room for elsewhere"}
      subtitle={p.name + " · " + room.name}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="stay-booking" onSubmit={submit}>
        <ol className="booking-progress">
          {["Your stay", "Guest details", "Review & reserve"].map(
            (label, i) => (
              <li
                key={label}
                className={step === i ? "current" : step > i ? "done" : ""}
                aria-current={step === i ? "step" : undefined}
              >
                <span>{step > i ? <Check size={13} /> : i + 1}</span>
                {label}
              </li>
            ),
          )}
        </ol>
        <ErrorNotice error={error} />
        {step === 0 && (
          <>
            <div className="booking-room">
              <img
                src={room.image}
                alt="Illustrative guest room"
                width="200"
                height="150"
              />
              <div>
                <h3>{room.name}</h3>
                <p>
                  {money(existing?.nightlyRate || room.price)} / night · Up to{" "}
                  {room.capacity} guests
                </p>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Check-in">
                <input
                  required
                  type="date"
                  min={dateKey()}
                  value={input.checkIn}
                  onChange={(e) =>
                    setInput({ ...input, checkIn: e.target.value })
                  }
                />
              </Field>
              <Field label="Check-out">
                <input
                  required
                  type="date"
                  min={addDays(input.checkIn || dateKey(), 1)}
                  value={input.checkOut}
                  onChange={(e) =>
                    setInput({ ...input, checkOut: e.target.value })
                  }
                />
              </Field>
              <Field label="Guests">
                <select
                  value={input.guests}
                  onChange={(e) =>
                    setInput({ ...input, guests: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: room.capacity }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} {i ? "guests" : "guest"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Offer code (optional)">
                <input
                  maxLength={30}
                  placeholder="e.g. SLOWDAYS"
                  value={input.promotionCode}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      promotionCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </Field>
            </div>
            <h3>A little extra to look forward to</h3>
            <p>
              Optional experiences. Each price is for the reservation, once per
              stay.
            </p>
            <div className="extra-options">
              {data.experiences
                .filter((e) => e.propertyId === p.id && e.active)
                .map((extra) => (
                  <label key={extra.id}>
                    <input
                      type="checkbox"
                      checked={input.experienceIds.includes(extra.id)}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          experienceIds: e.target.checked
                            ? [...input.experienceIds, extra.id]
                            : input.experienceIds.filter(
                                (id) => id !== extra.id,
                              ),
                        })
                      }
                    />
                    <span>
                      <strong>{extra.name}</strong>
                      <small>{extra.description}</small>
                    </span>
                    <strong>{money(extra.price)}</strong>
                  </label>
                ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h3>Who is coming along?</h3>
            <p>Use sample information while trying this local demo.</p>
            {user.role !== "customer" && !existing && (
              <Field label="Guest account">
                <select
                  required
                  value={input.customerId}
                  onChange={(e) => {
                    const g = db.users.find((u) => u.id === e.target.value)!;
                    setInput({
                      ...input,
                      customerId: g.id,
                      guestName: g.name,
                      email: g.email,
                      phone: g.phone,
                    });
                  }}
                >
                  <option value="" disabled>
                    Select guest account
                  </option>
                  {db.users
                    .filter((u) => u.role === "customer")
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} · {g.email}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <div className="form-grid">
              <Field label="Lead guest name">
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={input.guestName}
                  onChange={(e) =>
                    setInput({ ...input, guestName: e.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={input.email}
                  onChange={(e) =>
                    setInput({ ...input, email: e.target.value })
                  }
                />
              </Field>
              <Field label="Phone">
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={input.phone}
                  onChange={(e) =>
                    setInput({ ...input, phone: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Special requests (optional)">
              <textarea
                maxLength={1000}
                rows={3}
                placeholder="Anything that would make your stay more comfortable?"
                value={input.notes}
                onChange={(e) => setInput({ ...input, notes: e.target.value })}
              />
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <div className="stay-review">
              <div>
                <p className="eyebrow">Your elsewhere</p>
                <h3>{p.name}</h3>
                <p>
                  {room.name} · {input.guests} guests
                </p>
                <p>
                  {input.checkIn} → {input.checkOut} · {summary?.nights} nights
                </p>
                <p>Check-in 2 PM · Check-out 11 AM · Manila</p>
              </div>
              <div>
                <p className="eyebrow">Lead guest</p>
                <h3>{input.guestName}</h3>
                <p>{input.email}</p>
                <p>{input.phone}</p>
              </div>
            </div>
            <h3>How would you prefer to pay?</h3>
            <p>
              Save your preference. No money, bank details, or payment proof is
              collected.
            </p>
            <fieldset className="payment-options">
              <legend className="sr-only">Payment preference</legend>
              {PAYMENT_METHODS.map((method) => (
                <label
                  className={input.paymentMethod === method ? "chosen" : ""}
                  key={method}
                >
                  <input
                    type="radio"
                    name="payment"
                    aria-label={paymentName(method)}
                    checked={input.paymentMethod === method}
                    onChange={() =>
                      setInput({ ...input, paymentMethod: method })
                    }
                  />
                  <PaymentIcon method={method} />
                  <span>{paymentName(method)}</span>
                  {input.paymentMethod === method && <CheckCircle2 size={16} />}
                </label>
              ))}
            </fieldset>
            <div className="price-breakdown">
              <p>
                <span>
                  {summary?.nights} nights × {money(summary?.nightlyRate || 0)}
                </span>
                <strong>{money(summary?.subtotal || 0)}</strong>
              </p>
              {!!summary?.discount && (
                <p>
                  <span>Offer {input.promotionCode}</span>
                  <strong>−{money(summary.discount)}</strong>
                </p>
              )}
              {summary?.experiences.map((e, i) => (
                <p key={i}>
                  <span>{e.name}</span>
                  <strong>{money(e.price)}</strong>
                </p>
              ))}
              <p className="total">
                <span>Reservation total</span>
                <strong>{money(summary?.total || 0)}</strong>
              </p>
              <small>
                PHP · Listed room rates include demo taxes. No additional fees.
              </small>
            </div>
            <p className="fine-print">
              {p.policy} Requests can be rescheduled or cancelled before the
              check-in day. This is a mock reservation.
            </p>
          </>
        )}
        <div className="booking-actions">
          {step > 0 ? (
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              Back
            </button>
          ) : (
            <span className="fine-print">
              1–30 nights · One room per reservation
            </span>
          )}
          <SubmitButton busy={busy}>
            {step < 2
              ? "Continue"
              : existing
                ? "Save new dates"
                : "Request reservation"}
            <ArrowRight size={16} />
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
export function ReservationDetail({
  reservation: r,
  user,
  onClose,
  onEdit,
  notify,
}: {
  reservation: Reservation;
  user: User;
  onClose: () => void;
  onEdit: () => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false);
  const active = ["Pending", "Confirmed"].includes(r.status),
    upcoming = r.checkIn > dateKey();
  async function status(s: Status) {
    setBusy(true);
    setError("");
    try {
      await api.reservationStatus(r.id, s);
      notify("Reservation " + s.toLowerCase() + ".");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Reservation details"
      subtitle={r.id}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="reservation-detail">
        <ErrorNotice error={error} />
        <Badge status={r.status} />
        <h3>{r.propertyName}</h3>
        <p>
          {r.roomName} · {r.guests} guests · {r.nights} nights
        </p>
        <p>
          {r.checkIn} → {r.checkOut} · Manila time
        </p>
        <hr />
        <h3>{r.guestName}</h3>
        <p>
          {r.email}
          <br />
          {r.phone}
        </p>
        {r.notes && <p>Special requests: {r.notes}</p>}
        <div className="price-breakdown">
          <p>
            <span>Room subtotal</span>
            <strong>{money(r.subtotal)}</strong>
          </p>
          {r.discount > 0 && (
            <p>
              <span>Offer {r.promotionCode}</span>
              <strong>−{money(r.discount)}</strong>
            </p>
          )}
          {r.experiences.map((e, i) => (
            <p key={i}>
              <span>{e.name}</span>
              <strong>{money(e.price)}</strong>
            </p>
          ))}
          <p className="total">
            <span>Total</span>
            <strong>{money(r.total)}</strong>
          </p>
        </div>
        <p>
          {paymentName(r.paymentMethod)} · Preference only, no payment
          collected.
        </p>
        <p className="fine-print">
          Fictional demo reservation. Confirmation events are queued locally and
          no email is sent.
        </p>
        <div className="detail-actions">
          {active && upcoming && (
            <button className="btn secondary" disabled={busy} onClick={onEdit}>
              Change dates
            </button>
          )}
          {active && user.role !== "customer" && (
            <>
              {r.status === "Pending" && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => status("Confirmed")}
                >
                  Confirm request
                </button>
              )}
              <button
                className="btn secondary"
                disabled={busy || r.checkOut > dateKey()}
                onClick={() => status("Completed")}
              >
                Complete stay
              </button>
              <button
                className="btn secondary"
                disabled={busy || upcoming}
                onClick={() => status("No-show")}
              >
                Mark no-show
              </button>
            </>
          )}
          {active && (upcoming || user.role !== "customer") && (
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => setCancel(true)}
            >
              Cancel reservation
            </button>
          )}
        </div>
        {cancel && (
          <div className="cancel-confirm" role="alert">
            <p>
              Cancel this reservation? The room inventory will be released for
              these dates.
            </p>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => status("Cancelled")}
            >
              Yes, cancel reservation
            </button>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setCancel(false)}
            >
              Keep reservation
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
