import { z } from "zod";
import type { Database, User, Status, PaymentMethod } from "../types";
import { PAYMENT_METHODS } from "../types";
import { dateSchema, profileSchema } from "./validation";
import { dateKey, addDays } from "./date";

export type Property = {
  id: string;
  name: string;
  destination: string;
  kind: "Coast" | "Forest" | "Island";
  description: string;
  image: string;
  gallery: string[];
  amenities: string[];
  address: string;
  rating: number;
  active: boolean;
  managerIds: string[];
  policy: string;
};
export type Room = {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  image: string;
  price: number;
  capacity: number;
  inventory: number;
  active: boolean;
  blockedDates: string[];
  amenities: string[];
};
export type Experience = {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  active: boolean;
};
export type Promotion = {
  id: string;
  code: string;
  title: string;
  description: string;
  percent: number;
  endDate: string;
  active: boolean;
};
export type Reservation = {
  id: string;
  customerId: string;
  propertyId: string;
  roomId: string;
  propertyName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  email: string;
  phone: string;
  nightlyRate: number;
  nights: number;
  subtotal: number;
  discount: number;
  total: number;
  promotionCode: string;
  experienceIds: string[];
  experiences: { name: string; price: number }[];
  status: Status;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
};
export type TravelData = {
  properties: Property[];
  rooms: Room[];
  experiences: Experience[];
  promotions: Promotion[];
  reservations: Reservation[];
  events: {
    id: string;
    reservationId: string;
    recipientId: string;
    message: string;
    createdAt: string;
    delivery: "queued";
  }[];
};
export type StaySearch = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};
export type ReservationInput = Omit<StaySearch, "destination"> & {
  customerId: string;
  roomId: string;
  guestName: string;
  email: string;
  phone: string;
  paymentMethod: PaymentMethod;
  promotionCode: string;
  experienceIds: string[];
  notes: string;
};
export const reservationSchema = z.object({
  customerId: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: dateSchema,
  checkOut: dateSchema,
  guests: z.number().int().min(1).max(12),
  guestName: profileSchema.shape.name,
  email: profileSchema.shape.email,
  phone: profileSchema.shape.phone,
  paymentMethod: z.enum(PAYMENT_METHODS),
  promotionCode: z.string().trim().toUpperCase().max(30),
  experienceIds: z.array(z.string()).max(10),
  notes: z.string().trim().max(1000),
});
export function travel(db: Database): TravelData {
  if (!db.travel) throw new Error("The travel collection is still loading.");
  return db.travel;
}
export const nightsBetween = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
export function validateDates(
  checkIn: string,
  checkOut: string,
  now = new Date(),
) {
  dateSchema.parse(checkIn);
  dateSchema.parse(checkOut);
  if (checkIn < dateKey(now))
    throw new Error("Check-in cannot be in the past.");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > 30)
    throw new Error(
      "Choose a stay of 1 to 30 nights, with check-out after check-in.",
    );
  return nights;
}
export const activeReservation = (r: Reservation) =>
  !["Cancelled", "No-show"].includes(r.status);
export function roomsLeft(
  data: TravelData,
  room: Room,
  checkIn: string,
  checkOut: string,
  excludeId?: string,
) {
  const property = data.properties.find((p) => p.id === room.propertyId);
  if (
    !room.active ||
    !property?.active ||
    room.blockedDates.some((d) => d >= checkIn && d < checkOut)
  )
    return 0;
  let peak = 0;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1))
    peak = Math.max(
      peak,
      data.reservations.filter(
        (r) =>
          r.id !== excludeId &&
          r.roomId === room.id &&
          activeReservation(r) &&
          r.checkIn <= d &&
          r.checkOut > d,
      ).length,
    );
  return Math.max(0, room.inventory - peak);
}
export function canManageProperty(actor: User, property: Property) {
  return (
    actor.role === "admin" ||
    (actor.role === "staff" &&
      property.managerIds.includes(actor.staffId || ""))
  );
}
export function canAccessReservation(
  data: TravelData,
  actor: User,
  r: Reservation,
) {
  const property = data.properties.find((p) => p.id === r.propertyId);
  return (
    actor.id === r.customerId ||
    (!!property && canManageProperty(actor, property))
  );
}
export function quote(
  data: TravelData,
  raw: ReservationInput,
  now = new Date(),
  existing?: Reservation,
) {
  const input = reservationSchema.parse(raw),
    nights = validateDates(input.checkIn, input.checkOut, now);
  const room = data.rooms.find((r) => r.id === input.roomId),
    property = room && data.properties.find((p) => p.id === room.propertyId);
  if (!room || !property || !room.active || !property.active)
    throw new Error("This stay is unavailable.");
  if (input.guests > room.capacity)
    throw new Error("The guest count exceeds this room’s capacity.");
  if (roomsLeft(data, room, input.checkIn, input.checkOut, existing?.id) < 1)
    throw new Error(
      "This room is fully booked or closed on your selected dates.",
    );
  if (new Set(input.experienceIds).size !== input.experienceIds.length)
    throw new Error("Choose each experience only once.");
  const selected = input.experienceIds.map((id) =>
    data.experiences.find(
      (e) => e.id === id && e.active && e.propertyId === property.id,
    ),
  );
  if (selected.some((e) => !e))
    throw new Error("One of your selected experiences is unavailable.");
  const experiences = selected.map((e) => ({ name: e!.name, price: e!.price }));
  const nightlyRate = existing?.nightlyRate ?? room.price,
    subtotal = nightlyRate * nights;
  let discount = 0;
  if (input.promotionCode) {
    const promotion = data.promotions.find(
      (p) =>
        p.active && p.code === input.promotionCode && p.endDate >= dateKey(now),
    );
    if (!promotion) throw new Error("This offer code is invalid or expired.");
    discount = Math.round(subtotal * promotion.percent) / 100;
  }
  const total =
    Math.round(
      (subtotal - discount + experiences.reduce((sum, e) => sum + e.price, 0)) *
        100,
    ) / 100;
  return {
    input,
    room,
    property,
    nights,
    nightlyRate,
    subtotal,
    discount,
    total,
    experiences,
  };
}
function event(data: TravelData, r: Reservation, message: string) {
  data.events.unshift({
    id: crypto.randomUUID(),
    reservationId: r.id,
    recipientId: r.customerId,
    message,
    createdAt: new Date().toISOString(),
    delivery: "queued",
  });
}
export function reserve(
  db: Database,
  actor: User,
  raw: ReservationInput,
  now = new Date(),
  id?: string,
) {
  const data = travel(db),
    existing = id ? data.reservations.find((r) => r.id === id) : undefined;
  if (id && (!existing || !canAccessReservation(data, actor, existing)))
    throw new Error("Reservation not found or access denied.");
  if (
    existing &&
    (!["Pending", "Confirmed"].includes(existing.status) ||
      existing.checkIn <= dateKey(now))
  )
    throw new Error("Only upcoming active reservations can be rescheduled.");
  if (
    existing &&
    (existing.customerId !== raw.customerId || existing.roomId !== raw.roomId)
  )
    throw new Error("Keep the original guest and room when rescheduling.");
  if (actor.role === "customer" && actor.id !== raw.customerId)
    throw new Error("You can only reserve for yourself.");
  if (!db.users.some((u) => u.id === raw.customerId && u.role === "customer"))
    throw new Error("Select a valid guest account.");
  const q = quote(data, raw, now, existing);
  if (actor.role === "staff" && !canManageProperty(actor, q.property))
    throw new Error("This property is outside your staff permissions.");
  const r: Reservation = {
    id: existing?.id || "AT-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    customerId: q.input.customerId,
    propertyId: q.property.id,
    roomId: q.room.id,
    propertyName: existing?.propertyName || q.property.name,
    roomName: existing?.roomName || q.room.name,
    checkIn: q.input.checkIn,
    checkOut: q.input.checkOut,
    guests: q.input.guests,
    guestName: q.input.guestName,
    email: q.input.email,
    phone: q.input.phone,
    nightlyRate: q.nightlyRate,
    nights: q.nights,
    subtotal: q.subtotal,
    discount: q.discount,
    total: q.total,
    promotionCode: q.input.promotionCode,
    experienceIds: q.input.experienceIds,
    experiences: q.experiences,
    paymentMethod: q.input.paymentMethod,
    notes: q.input.notes,
    status:
      existing?.status || (actor.role === "customer" ? "Pending" : "Confirmed"),
    createdAt: existing?.createdAt || now.toISOString(),
  };
  if (existing) Object.assign(existing, r);
  else data.reservations.push(r);
  event(
    data,
    r,
    existing ? "Reservation rescheduled" : "Reservation request received",
  );
  return r;
}
export function reservationStatus(
  db: Database,
  actor: User,
  id: string,
  status: Status,
  now = new Date(),
) {
  const data = travel(db),
    r = data.reservations.find((r) => r.id === id);
  if (!r || !canAccessReservation(data, actor, r))
    throw new Error("Reservation not found or access denied.");
  if (!["Pending", "Confirmed"].includes(r.status))
    throw new Error("This reservation is already closed.");
  if (
    actor.role === "customer" &&
    (status !== "Cancelled" || r.checkIn <= dateKey(now))
  )
    throw new Error("You can only cancel your upcoming reservations.");
  if (
    !["Confirmed", "Completed", "Cancelled", "No-show"].includes(status) ||
    status === r.status
  )
    throw new Error("Choose a valid new status.");
  if (status === "Completed" && r.checkOut > dateKey(now))
    throw new Error("Complete a stay after its check-out date.");
  if (status === "No-show" && r.checkIn > dateKey(now))
    throw new Error("No-show is available after check-in.");
  r.status = status;
  event(data, r, "Reservation " + status.toLowerCase());
  return r;
}
const imageSchema = z.enum([
  "/images/island.jpg",
  "/images/coast.jpg",
  "/images/forest.jpg",
  "/images/pool.jpg",
  "/images/room.jpg",
  "/images/dining.jpg",
]);
const propertySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(100),
  destination: z.string().trim().min(2).max(80),
  kind: z.enum(["Coast", "Forest", "Island"]),
  description: z.string().trim().min(20).max(2000),
  image: imageSchema,
  gallery: z.array(imageSchema),
  amenities: z.array(z.string().min(1)),
  address: z.string().trim().min(5),
  rating: z.number().min(0).max(5),
  active: z.boolean(),
  managerIds: z.array(z.string()),
  policy: z.string().min(10),
});
const roomSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  name: z.string().trim().min(2),
  description: z.string().trim().min(10),
  image: imageSchema,
  price: z
    .number()
    .min(100)
    .max(100000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7),
  capacity: z.number().int().min(1).max(12),
  inventory: z.number().int().min(1).max(100),
  active: z.boolean(),
  blockedDates: z.array(dateSchema),
  amenities: z.array(z.string()),
});
export function saveProperty(db: Database, actor: User, raw: Property) {
  if (actor.role !== "admin")
    throw new Error("Only an administrator can edit properties.");
  const data = travel(db),
    p = propertySchema.parse(raw);
  if (p.managerIds.some((id) => !db.staff.some((s) => s.id === id && s.active)))
    throw new Error("Select active property managers.");
  if (
    !p.active &&
    data.reservations.some(
      (r) =>
        r.propertyId === p.id &&
        ["Pending", "Confirmed"].includes(r.status) &&
        r.checkOut > dateKey(),
    )
  )
    throw new Error(
      "Resolve upcoming reservations before archiving this property.",
    );
  const existing = data.properties.find((x) => x.id === p.id);
  if (existing) Object.assign(existing, p);
  else data.properties.push({ ...p, id: crypto.randomUUID() });
}
export function saveRoom(db: Database, actor: User, raw: Room) {
  const data = travel(db),
    room = roomSchema.parse(raw),
    property = data.properties.find((p) => p.id === room.propertyId);
  if (!property || !canManageProperty(actor, property))
    throw new Error(
      "Only assigned staff or administrators can edit room availability.",
    );
  if (actor.role === "staff") {
    const original = data.rooms.find((r) => r.id === room.id);
    if (
      !original ||
      original.propertyId !== room.propertyId ||
      original.name !== room.name ||
      original.price !== room.price ||
      original.capacity !== room.capacity ||
      original.description !== room.description ||
      original.image !== room.image ||
      JSON.stringify(original.amenities) !== JSON.stringify(room.amenities)
    )
      throw new Error(
        "Staff can update inventory, closures, and room availability only.",
      );
  }
  const upcoming = data.reservations.filter(
    (r) =>
      r.roomId === room.id &&
      ["Pending", "Confirmed"].includes(r.status) &&
      r.checkOut > dateKey(),
  );
  const candidate = {
    ...data,
    rooms: data.rooms.map((r) => (r.id === room.id ? room : r)),
  };
  if (
    upcoming.some(
      (r) =>
        room.capacity < r.guests ||
        roomsLeft(candidate, room, r.checkIn, r.checkOut, r.id) < 1,
    )
  )
    throw new Error(
      "This inventory or closure change conflicts with upcoming reservations.",
    );
  const existing = data.rooms.find((r) => r.id === room.id);
  if (existing) Object.assign(existing, room);
  else data.rooms.push({ ...room, id: crypto.randomUUID() });
}
export function savePromotion(db: Database, actor: User, raw: Promotion) {
  if (actor.role !== "admin")
    throw new Error("Only an administrator can manage offers.");
  const p = z
      .object({
        id: z.string(),
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{3,20}$/),
        title: z.string().trim().min(3),
        description: z.string().trim().min(10),
        percent: z.number().int().min(1).max(50),
        endDate: dateSchema,
        active: z.boolean(),
      })
      .parse(raw),
    data = travel(db);
  if (data.promotions.some((x) => x.code === p.code && x.id !== p.id))
    throw new Error("This offer code already exists.");
  const existing = data.promotions.find((x) => x.id === p.id);
  if (existing) Object.assign(existing, p);
  else data.promotions.push({ ...p, id: crypto.randomUUID() });
}

export function saveExperience(db: Database, actor: User, raw: Experience) {
  if (actor.role !== "admin")
    throw new Error("Only an administrator can manage experiences.");
  const data = travel(db),
    value = z
      .object({
        id: z.string(),
        propertyId: z.string(),
        name: z.string().trim().min(3).max(100),
        description: z.string().trim().min(10).max(2000),
        price: z
          .number()
          .min(0)
          .max(100000)
          .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7),
        image: imageSchema,
        active: z.boolean(),
      })
      .parse(raw);
  if (!data.properties.some((p) => p.id === value.propertyId))
    throw new Error("Select a valid property.");
  const existing = data.experiences.find((e) => e.id === value.id);
  if (existing) Object.assign(existing, value);
  else data.experiences.push({ ...value, id: crypto.randomUUID() });
}
