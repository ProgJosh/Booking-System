import type { Booking, BookingInput, Database, ScheduleDay, Service, Settings, Staff, Status, User } from '../types';
import { bookingSchema, dateSchema, emailSchema, nameSchema, phoneSchema, serviceSchema, timeSchema } from './validation';
import { clock, dateKey, instant, minutes, timeKey, weekday } from './date';
export const occupies = (b: Booking) => !['Cancelled', 'No-show'].includes(b.status);
export function canAccess(actor: User, booking: Booking) { return actor.role === 'admin' || (actor.role === 'staff' ? actor.staffId === booking.staffId : actor.id === booking.customerId); }
export function requireAdmin(actor: User) { if (actor.role !== 'admin') throw new Error('Only an administrator can make this change.'); }
export function validateSchedule(schedule: ScheduleDay[]) {
  if (schedule.length !== 7 || new Set(schedule.map(s => s.day)).size !== 7 || schedule.some(s => s.day < 0 || s.day > 6 || !Number.isInteger(s.day))) throw new Error('A schedule must contain each day of the week once.');
  for (const d of schedule) { timeSchema.parse(d.start); timeSchema.parse(d.end); if (d.open && (minutes(d.end) <= minutes(d.start) || minutes(d.start) % 15 || minutes(d.end) % 15)) throw new Error('Opening hours must be in 15-minute increments, with closing after opening.'); }
}
function fitsSchedule(db: Database, staff: Staff, start: string, end: string) {
  const date = dateKey(start);
  if (date !== dateKey(end) || db.settings.closedDates.includes(date) || staff.daysOff.includes(date)) return false;
  const day = weekday(date), business = db.settings.schedule.find(s => s.day === day), personal = staff.schedule.find(s => s.day === day);
  return Boolean(business?.open && personal?.open && minutes(timeKey(start)) >= Math.max(minutes(business.start), minutes(personal.start)) && minutes(timeKey(end)) <= Math.min(minutes(business.end), minutes(personal.end)));
}
export function validateBooking(db: Database, input: BookingInput, now = new Date(), excludeId?: string) {
  const data = bookingSchema.parse(input);
  const original = excludeId ? db.bookings.find(b => b.id === excludeId && b.serviceId === data.serviceId) : undefined;
  const catalogService = db.services.find(s => s.id === data.serviceId && (s.active || Boolean(original)));
  const service = catalogService && original ? { ...catalogService, duration: original.duration, price: original.price } : catalogService;
  const provider = db.staff.find(s => s.id === data.staffId && s.active);
  if (!db.users.some(u => u.id === data.customerId && u.role === 'customer')) throw new Error('Select a valid customer.');
  if (!service) throw new Error('This service is unavailable.');
  if (!provider || !provider.serviceIds.includes(service.id)) throw new Error('This provider is unavailable for the selected service.');
  if (minutes(data.time) % 15 !== 0) throw new Error('Choose a valid 15-minute time slot.');
  const start = instant(data.date, data.time), end = new Date(start.getTime() + service.duration * 60000);
  if (start.getTime() <= now.getTime()) throw new Error('Appointments must be booked in the future.');
  if (!fitsSchedule(db, provider, start.toISOString(), end.toISOString())) throw new Error('This time falls outside availability or on a closed date.');
  const overlap = db.bookings.find(b => b.id !== excludeId && occupies(b) && (b.staffId === provider.id || b.customerId === data.customerId) && start.getTime() < Date.parse(b.end) && end.getTime() > Date.parse(b.start));
  if (overlap) throw new Error(overlap.staffId === provider.id ? 'This provider is already booked at that time. Please choose another slot.' : 'This customer already has an overlapping appointment.');
  return { service, provider, start: start.toISOString(), end: end.toISOString() };
}
export function availableSlots(db: Database, input: Omit<BookingInput, 'time' | 'notes' | 'paymentMethod'>, now = new Date(), excludeId?: string) {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) { const time = clock(m); try { validateBooking(db, { ...input, time, paymentMethod: 'Cash at studio', notes: '' }, now, excludeId); slots.push(time); } catch { /* Unavailable slots are omitted. */ } }
  return slots;
}
function enqueue(db: Database, booking: Booking, type: Database['notifications'][number]['type']) { db.notifications.unshift({ id: crypto.randomUUID(), bookingId: booking.id, recipientId: booking.customerId, type, channel: 'email', delivery: 'queued', createdAt: new Date().toISOString(), message: `${booking.serviceName} · ${type === 'booking.rescheduled' ? 'Rescheduled' : booking.status}` }); }
export function createBooking(db: Database, actor: User, input: BookingInput, now = new Date()) {
  if (actor.role === 'customer' && actor.id !== input.customerId) throw new Error('You can only book for yourself.');
  if (actor.role === 'staff' && actor.staffId !== input.staffId) throw new Error('Staff can only book their own appointments.');
  const { service, start, end } = validateBooking(db, input, now);
  const booking: Booking = { id: `MR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customerId: input.customerId, serviceId: service.id, staffId: input.staffId, start, end, price: service.price, serviceName: service.name, duration: service.duration, status: actor.role === 'customer' ? 'Pending' : 'Confirmed', paymentMethod: input.paymentMethod, notes: input.notes.trim(), createdAt: now.toISOString() };
  db.bookings.push(booking); enqueue(db, booking, 'booking.created'); return booking;
}
export function rescheduleBooking(db: Database, actor: User, id: string, input: BookingInput, now = new Date()) {
  const booking = db.bookings.find(b => b.id === id);
  if (!booking || !canAccess(actor, booking)) throw new Error('Appointment not found or access denied.');
  if (!['Pending', 'Confirmed'].includes(booking.status) || Date.parse(booking.start) <= now.getTime()) throw new Error('Only upcoming active appointments can be rescheduled.');
  if (input.customerId !== booking.customerId || input.serviceId !== booking.serviceId) throw new Error('Keep the original customer and service when rescheduling.');
  if (actor.role === 'staff' && actor.staffId !== input.staffId) throw new Error('Staff can only manage their own appointments.');
  const { start, end, service } = validateBooking(db, input, now, id);
  Object.assign(booking, { start, end, staffId: input.staffId, paymentMethod: input.paymentMethod, notes: input.notes.trim(), duration: service.duration, status: actor.role === 'customer' ? 'Pending' : 'Confirmed' });
  enqueue(db, booking, 'booking.rescheduled'); return booking;
}
export function changeStatus(db: Database, actor: User, id: string, status: Status, now = new Date()) {
  const booking = db.bookings.find(b => b.id === id);
  if (!booking || !canAccess(actor, booking)) throw new Error('Appointment not found or access denied.');
  if (!['Pending', 'Confirmed'].includes(booking.status)) throw new Error('This appointment is already closed.');
  if (actor.role === 'customer' && (status !== 'Cancelled' || Date.parse(booking.start) <= now.getTime())) throw new Error('You can only cancel your upcoming appointments.');
  if (!['Confirmed', 'Completed', 'Cancelled', 'No-show'].includes(status) || status === booking.status) throw new Error('Choose a valid new status.');
  if (status === 'Completed' && Date.parse(booking.end) > now.getTime()) throw new Error('An appointment can only be completed after its end time.');
  if (status === 'No-show' && Date.parse(booking.start) > now.getTime()) throw new Error('No-show is available after the appointment starts.');
  booking.status = status; enqueue(db, booking, 'booking.status_changed'); return booking;
}
export function saveService(db: Database, actor: User, input: Service) {
  requireAdmin(actor); const service = serviceSchema.parse(input);
  if (db.services.some(s => s.id !== service.id && s.name.toLowerCase() === service.name.toLowerCase())) throw new Error('A service with this name already exists.');
  const existing = db.services.find(s => s.id === service.id);
  if (existing) Object.assign(existing, service); else db.services.push({ ...service, id: crypto.randomUUID() });
}
export function saveStaff(db: Database, actor: User, input: Staff, now = new Date()) {
  requireAdmin(actor); input = { ...input, name: nameSchema.parse(input.name), email: emailSchema.parse(input.email), title: nameSchema.parse(input.title) }; validateSchedule(input.schedule); input.daysOff.forEach(d => dateSchema.parse(d));
  if (!input.serviceIds.length || input.serviceIds.some(id => !db.services.some(s => s.id === id))) throw new Error('Assign at least one valid service.');
  if (db.users.some(u => u.email.toLowerCase() === input.email.toLowerCase() && u.staffId !== input.id) || db.staff.some(s => s.id !== input.id && s.email.toLowerCase() === input.email.toLowerCase())) throw new Error('This email is already in use.');
  const future = db.bookings.filter(b => b.staffId === input.id && ['Pending', 'Confirmed'].includes(b.status) && Date.parse(b.end) > now.getTime());
  if (future.some(b => !input.active || !input.serviceIds.includes(b.serviceId) || !fitsSchedule(db, input, b.start, b.end))) throw new Error('This change conflicts with upcoming appointments. Reschedule or cancel them first.');
  const existing = db.staff.find(s => s.id === input.id);
  if (existing) { Object.assign(existing, input); const account = db.users.find(u => u.staffId === input.id); if (account) Object.assign(account, { name: input.name, email: input.email.toLowerCase() }); }
  else { const id = crypto.randomUUID(); db.staff.push({ ...input, id }); db.users.push({ id: crypto.randomUUID(), name: input.name, email: input.email.toLowerCase(), phone: '+886 900 000 000', role: 'staff', staffId: id }); }
}
export function saveSettings(db: Database, actor: User, input: Settings, now = new Date()) {
  requireAdmin(actor); input = { ...input, name: nameSchema.parse(input.name), email: emailSchema.parse(input.email), phone: phoneSchema.parse(input.phone), address: nameSchema.parse(input.address) }; validateSchedule(input.schedule); input.closedDates.forEach(d => dateSchema.parse(d));
  const candidate = { ...db, settings: input };
  if (db.bookings.some(b => ['Pending', 'Confirmed'].includes(b.status) && Date.parse(b.end) > now.getTime() && !fitsSchedule(candidate, db.staff.find(s => s.id === b.staffId)!, b.start, b.end))) throw new Error('These hours or closures conflict with upcoming appointments. Reschedule or cancel them first.');
  db.settings = { ...input, timezone: 'Asia/Manila' };
}
