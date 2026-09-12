import type { BookingInput, Database, Role, Service, Settings, Staff, Status, User } from '../types';
import { PAYMENT_METHODS } from '../types';
import { createSeed, defaultSchedule } from '../data/seed';
import * as domain from './domain';
import { emailSchema, profileSchema, registerSchema } from './validation';
import { TIMEZONE } from './date';
const DATA_KEY = 'morrow.database.v1';
const SESSION_KEY = 'morrow.session.v1';
export const DEMO_PASSWORD = 'Morrow2026!';
export const DEMO_ACCOUNTS = { admin: 'admin@BookSync.demo', staff: 'emmanuel.staff@Wellora.demo', customer: 'emmanuel.josh.velo@example.com' };
let queue: Promise<unknown> = Promise.resolve();
let initializing: Promise<void> | undefined;
let coordinationDatabase: Promise<IDBDatabase> | undefined;
function read(): Database { const raw = localStorage.getItem(DATA_KEY); if (!raw) throw new Error('Your workspace is still loading.'); const data = JSON.parse(raw) as Database; if (data.version !== 1 || !Array.isArray(data.bookings)) throw new Error('Stored workspace data is invalid. Restore your browser data or use a fresh browser profile.'); return data; }
function write(db: Database) { try { localStorage.setItem(DATA_KEY, JSON.stringify(db)); } catch { throw new Error('Unable to save. Your browser storage may be full or disabled.'); } }
async function passwordDigest(password: string, salt: string) { const encoder = new TextEncoder(); const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256); return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, '0')).join(''); }
async function credentials(password: string) { const salt = crypto.randomUUID(); return { salt, passwordHash: await passwordDigest(password, salt) }; }
function actor(db: Database) { const id = localStorage.getItem(SESSION_KEY); const user = db.users.find(u => u.id === id); if (!user) throw new Error('Please sign in to continue.'); if (user.role === 'staff' && !db.staff.some(s => s.id === user.staffId && s.active)) throw new Error('Your staff account is inactive.'); return user; }
function emit() { window.dispatchEvent(new Event('morrow:update')); }
function requestResult<T>(request: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Browser coordination failed.')); }); }
function transactionComplete(transaction: IDBTransaction) { return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error || new Error('Browser coordination failed.')); transaction.onabort = () => reject(transaction.error || new Error('Browser coordination was interrupted.')); }); }
function openCoordinationDatabase() {
  if (!coordinationDatabase) coordinationDatabase = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('morrow.coordination.v1', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('locks')) request.result.createObjectStore('locks', { keyPath: 'name' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Browser coordination is unavailable.'));
  });
  return coordinationDatabase;
}
type Lease = { name: string; owner: string; expiresAt: number };
async function tryAcquireLease(owner: string) {
  const database = await openCoordinationDatabase();
  const transaction = database.transaction('locks', 'readwrite'), done = transactionComplete(transaction), store = transaction.objectStore('locks');
  const current = await requestResult(store.get('database')) as Lease | undefined;
  const acquired = !current || current.expiresAt <= Date.now();
  if (acquired) await requestResult(store.put({ name: 'database', owner, expiresAt: Date.now() + 15_000 } satisfies Lease));
  await done;
  return acquired;
}
async function releaseLease(owner: string) {
  const database = await openCoordinationDatabase();
  const transaction = database.transaction('locks', 'readwrite'), done = transactionComplete(transaction), store = transaction.objectStore('locks');
  const current = await requestResult(store.get('database')) as Lease | undefined;
  if (current?.owner === owner) await requestResult(store.delete('database'));
  await done;
}
async function withPersistentLock<T>(operation: () => T | Promise<T>) {
  const owner = crypto.randomUUID(), deadline = Date.now() + 10_000;
  while (!await tryAcquireLease(owner)) {
    if (Date.now() >= deadline) throw new Error('The workspace is busy in another tab. Please try again.');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  try { return await operation(); } finally { await releaseLease(owner); }
}
async function withDatabaseLock<T>(operation: () => T | Promise<T>): Promise<T> {
  if (typeof indexedDB !== 'undefined') {
    try { await openCoordinationDatabase(); } catch { coordinationDatabase = undefined; }
    if (coordinationDatabase) return withPersistentLock(operation);
  }
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('morrow:database', operation);
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}
async function transaction<T>(operation: (db: Database, user: User) => T | Promise<T>): Promise<T> {
  return withDatabaseLock(async () => {
    // Read again while holding the lock; a different tab may have just booked this slot.
    const db = read();
    const user = actor(db);
    const result = await operation(db, user);
    write(db);
    emit();
    return result;
  });
}
function visible(db: Database, user: User): Database {
  const bookings = db.bookings.filter(b => domain.canAccess(user, b));
  return { ...db, bookings, users: db.users.filter(u => user.role === 'admin' || u.id === user.id || (user.role === 'staff' && bookings.some(b => b.customerId === u.id))).map(({ passwordHash: _hash, salt: _salt, ...u }) => u), notifications: db.notifications.filter(n => user.role === 'admin' || bookings.some(b => b.id === n.bookingId)) };
}
export const api = {
  async initialize() {
    if (!initializing) initializing = withDatabaseLock(async () => {
      if (!localStorage.getItem(DATA_KEY)) {
        const db = createSeed();
        // Demo-only shared password hash. Newly created accounts use unique salts.
        const credential = await credentials(DEMO_PASSWORD);
        db.users.forEach(u => Object.assign(u, credential));
        write(db); localStorage.setItem(SESSION_KEY, 'admin-1');
      }
      const db = read();
      let migrated = false;
      if (db.settings.timezone !== TIMEZONE) {
        db.settings.timezone = TIMEZONE;
        migrated = true;
      }
      if (['Morrow Wellness Studio', 'BookSync Wellness Studio'].includes(db.settings.name)) { db.settings.name = 'Wellness Studio'; migrated = true; }
      if (db.settings.email.toLowerCase() === 'hello@morrow.demo') { db.settings.email = 'hello@Wellora.demo'; migrated = true; }
      if (db.settings.address === '28 Lane 160, Dunhua South Road, Taipei') { db.settings.address = 'San Vicente, Lubao, Pampanga'; migrated = true; }
      db.bookings.forEach(booking => {
        if (!PAYMENT_METHODS.includes(booking.paymentMethod)) {
          booking.paymentMethod = 'Cash at studio';
          migrated = true;
        }
      });
      let emmanuelStaff = db.staff.find(member => member.name.toLowerCase() === 'emmanuel josh velo');
      if (!emmanuelStaff) {
        emmanuelStaff = { id: 'staff-emmanuel', name: 'Emmanuel Josh Velo', email: 'emmanuel.staff@Wellora.demo', title: 'Wellness specialist', serviceIds: db.services.map(service => service.id), active: true, color: 'blue', schedule: defaultSchedule(), daysOff: [] };
        db.staff.push(emmanuelStaff);
        migrated = true;
      }
      if (!db.users.some(user => user.role === 'staff' && user.staffId === emmanuelStaff.id)) {
        db.users.push({ id: 'user-staff-emmanuel', name: emmanuelStaff.name, email: emmanuelStaff.email, phone: '+63 917 000 0000', role: 'staff', staffId: emmanuelStaff.id, ...(await credentials(DEMO_PASSWORD)) });
        migrated = true;
      }
      const emmaUser = db.users.find(u => u.role === 'customer' && u.email === 'emma.thompson@example.com');
      if (emmaUser) { emmaUser.name = 'Emmanuel Josh Velo'; emmaUser.email = 'emmanuel.josh.velo@example.com'; migrated = true; }
      if (migrated) write(db);
    }).catch(error => { initializing = undefined; throw error; });
    return initializing;
  },
  snapshot() { const db = read(); try { const user = actor(db); return { db: visible(db, user), user: { ...user, passwordHash: undefined, salt: undefined } }; } catch { return { db: null, user: null }; } },
  async login(email: string, password: string) {
    const db = read(); const normalizedEmail = email.trim().toLowerCase(); const user = db.users.find(u => u.email.trim().toLowerCase() === normalizedEmail);
    if (!user?.salt || !user.passwordHash || await passwordDigest(password, user.salt) !== user.passwordHash) throw new Error('Email or password is incorrect.');
    if (user.role === 'staff' && !db.staff.find(s => s.id === user.staffId)?.active) throw new Error('Your staff account is inactive. Contact your administrator.');
    localStorage.setItem(SESSION_KEY, user.id); emit();
  },
  logout() { localStorage.setItem(SESSION_KEY, ''); emit(); },
  async register(input: { name: string; email: string; phone: string; password: string }) {
    const parsed = registerSchema.parse(input); const credential = await credentials(parsed.password);
    const run = () => { const db = read(); if (db.users.some(u => u.email === parsed.email)) throw new Error('An account with this email already exists.'); const user: User = { id: crypto.randomUUID(), name: parsed.name, email: parsed.email, phone: parsed.phone, role: 'customer', ...credential }; db.users.push(user); write(db); localStorage.setItem(SESSION_KEY, user.id); emit(); };
    await withDatabaseLock(run);
  },
  slots(input: Omit<BookingInput, 'time' | 'notes' | 'paymentMethod'>, excludeId?: string) { const db = read(); const user = actor(db); if (user.role === 'customer' && input.customerId !== user.id) return []; if (user.role === 'staff' && input.staffId !== user.staffId) return []; if (excludeId) { const booking = db.bookings.find(b => b.id === excludeId); if (!booking || !domain.canAccess(user, booking) || booking.customerId !== input.customerId || booking.serviceId !== input.serviceId) return []; } return domain.availableSlots(db, input, new Date(), excludeId); },
  book(input: BookingInput) { return transaction((db, user) => domain.createBooking(db, user, input)); },
  reschedule(id: string, input: BookingInput) { return transaction((db, user) => domain.rescheduleBooking(db, user, id, input)); },
  status(id: string, status: Status) { return transaction((db, user) => domain.changeStatus(db, user, id, status)); },
  saveService(input: Service) { return transaction((db, user) => domain.saveService(db, user, input)); },
  saveStaff(input: Staff, password?: string) { return transaction(async (db, user) => { const isNew = !db.staff.some(s => s.id === input.id); if (isNew && (!password || password.length < 8)) throw new Error('Set an initial staff password with at least 8 characters.'); domain.saveStaff(db, user, input); if (isNew) { const account = db.users.find(u => u.email === emailSchema.parse(input.email))!; Object.assign(account, await credentials(password!)); } }); },
  saveSettings(input: Settings) { return transaction((db, user) => domain.saveSettings(db, user, input)); },
  saveCustomer(input: { id?: string; name: string; email: string; phone: string; notes?: string; password?: string }) { return transaction(async (db, user) => {
    domain.requireAdmin(user); const parsed = profileSchema.parse(input);
    if (db.users.some(u => u.email === parsed.email && u.id !== input.id)) throw new Error('This email is already in use.');
    if (input.id) { const target = db.users.find(u => u.id === input.id && u.role === 'customer'); if (!target) throw new Error('Customer not found.'); Object.assign(target, parsed, { notes: input.notes?.slice(0, 1000) || '' }); }
    else { registerSchema.parse({ ...parsed, password: input.password }); db.users.push({ ...parsed, id: crypto.randomUUID(), role: 'customer', notes: input.notes || '', ...await credentials(input.password!) }); }
  }); },
  saveProfile(input: { name: string; email: string; phone: string; currentPassword?: string; password?: string }) { return transaction(async (db, user) => {
    const parsed = profileSchema.parse(input); emailSchema.parse(parsed.email);
    if (db.users.some(u => u.email === parsed.email && u.id !== user.id)) throw new Error('This email is already in use.');
    if (input.password) { if (input.password.length < 8) throw new Error('Use at least 8 characters for your new password.'); if (!user.salt || await passwordDigest(input.currentPassword || '', user.salt) !== user.passwordHash) throw new Error('Your current password is incorrect.'); Object.assign(user, await credentials(input.password)); }
    Object.assign(user, parsed); const provider = db.staff.find(s => s.id === user.staffId); if (provider) Object.assign(provider, { name: parsed.name, email: parsed.email });
  }); },
};
export type Session = ReturnType<typeof api.snapshot>;
export function roleLabel(role: Role) { return role === 'admin' ? 'Administrator' : role === 'staff' ? 'Team member' : 'Customer'; }
