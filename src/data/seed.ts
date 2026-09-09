import type { Database, ScheduleDay } from '../types';
import { addDays, dateKey, instant, weekday } from '../lib/date';
export const defaultSchedule = (): ScheduleDay[] => Array.from({ length: 7 }, (_, day) => ({ day, open: day !== 0, start: '09:00', end: day === 6 ? '16:00' : '18:00' }));
export function createSeed(now = new Date()): Database {
  const today = dateKey(now);
  const services = [
    { id: 'svc-1', name: 'Signature Massage', description: 'A restorative full-body massage that releases tension and brings you back into balance.', duration: 60, price: 95, active: true, color: 'sage' },
    { id: 'svc-2', name: 'Radiance Facial', description: 'Personalized cleansing, gentle exfoliation, and deep hydration for a healthy glow.', duration: 60, price: 120, active: true, color: 'peach' },
    { id: 'svc-3', name: 'Wellness Consultation', description: 'A thoughtful one-to-one session to create a wellness plan around your lifestyle.', duration: 30, price: 45, active: true, color: 'lavender' },
    { id: 'svc-4', name: 'Deep Tissue Therapy', description: 'Focused bodywork for tight muscles, recovery, and lasting relief.', duration: 90, price: 145, active: true, color: 'blue' },
    { id: 'svc-5', name: 'Mindful Movement', description: 'A private guided movement and breathwork session for all experience levels.', duration: 45, price: 65, active: true, color: 'sand' },
    { id: 'svc-6', name: 'Scalp & Head Ritual', description: 'A calming scalp massage and aromatherapy ritual to clear the mind.', duration: 30, price: 55, active: true, color: 'rose' },
  ];
  const staff = [
    { id: 'staff-1', name: 'Olivia Chen', email: 'olivia@morrow.demo', title: 'Senior wellness therapist', serviceIds: ['svc-1', 'svc-3', 'svc-4', 'svc-6'], active: true, color: 'sage', schedule: defaultSchedule(), daysOff: [] },
    { id: 'staff-2', name: 'James Wilson', email: 'james@morrow.demo', title: 'Bodywork specialist', serviceIds: ['svc-1', 'svc-3', 'svc-4', 'svc-5'], active: true, color: 'sand', schedule: defaultSchedule(), daysOff: [] },
    { id: 'staff-3', name: 'Sophie Lee', email: 'sophie@morrow.demo', title: 'Skin & beauty specialist', serviceIds: ['svc-2', 'svc-3', 'svc-6'], active: true, color: 'peach', schedule: defaultSchedule(), daysOff: [] },
    { id: 'staff-4', name: 'Daniel Park', email: 'daniel@morrow.demo', title: 'Movement & wellness coach', serviceIds: ['svc-1', 'svc-3', 'svc-5'], active: true, color: 'lavender', schedule: defaultSchedule(), daysOff: [] },
  ];
  const names = ['Emma Thompson', 'Liam Anderson', 'Isabella Martinez', 'Noah Williams', 'Ava Robinson', 'Ethan Davis', 'Mia Johnson', 'Lucas Brown', 'Charlotte Taylor', 'Oliver Garcia', 'Amelia White', 'Henry Clark', 'Grace Lewis', 'Benjamin Hall', 'Ella Young', 'Jack Walker'];
  const users: Database['users'] = [
    { id: 'admin-1', name: 'Alex Morgan', email: 'admin@morrow.demo', phone: '+886 912 345 678', role: 'admin' },
    ...staff.map(s => ({ id: `user-${s.id}`, name: s.name, email: s.email, phone: '+886 912 111 222', role: 'staff' as const, staffId: s.id })),
    ...names.map((name, i) => ({ id: `customer-${i + 1}`, name, email: `${name.toLowerCase().replace(' ', '.')}@example.com`, phone: `+886 912 340 ${String(100 + i)}`, role: 'customer' as const, notes: '' })),
  ];
  const bookings: Database['bookings'] = [];
  for (let offset = -42; offset <= 12; offset++) {
    const day = addDays(today, offset);
    if (weekday(day) === 0) continue;
    for (let n = 0; n < (offset === 0 ? 9 : 4 + Math.abs(offset) % 5); n++) {
      const provider = staff[n % 4];
      const service = services.find(s => s.id === provider.serviceIds[(n + Math.abs(offset)) % provider.serviceIds.length])!;
      const hour = 9 + Math.floor(n / 4) * 3;
      const start = instant(day, `${String(hour).padStart(2, '0')}:${n % 2 ? '30' : '00'}`);
      const end = new Date(start.getTime() + service.duration * 60000);
      if (weekday(day) === 6 && hour >= 15) continue;
      const past = end.getTime() < now.getTime();
      const status = past ? (n === 2 && Math.abs(offset) % 5 === 0 ? 'Cancelled' : n === 3 && Math.abs(offset) % 7 === 0 ? 'No-show' : 'Completed') : n % 4 === 2 ? 'Pending' : 'Confirmed';
      bookings.push({ id: `MR-${1200 + bookings.length}`, customerId: `customer-${((n * 3 + Math.abs(offset)) % names.length) + 1}`, serviceId: service.id, serviceName: service.name, staffId: provider.id, start: start.toISOString(), end: end.toISOString(), duration: service.duration, price: service.price, status, notes: n === 0 ? 'Prefers a quiet room.' : '', createdAt: new Date(start.getTime() - 86400000 * 3).toISOString() });
    }
  }
  return { version: 1, users, services, staff, bookings, notifications: [], settings: { name: 'Morrow Wellness Studio', email: 'hello@morrow.demo', phone: '+886 2 2700 1234', address: '28 Lane 160, Dunhua South Road, Taipei', timezone: 'Asia/Taipei', schedule: defaultSchedule(), closedDates: [] } };
}
