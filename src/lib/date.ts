export const TIMEZONE = 'Asia/Taipei';
export const OFFSET = '+08:00';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });
export function dateKey(date: Date | string = new Date()) { return dateFormatter.format(new Date(date)); }
export function timeKey(date: Date | string) { return timeFormatter.format(new Date(date)); }
export function instant(date: string, time = '12:00') { return new Date(`${date}T${time}:00${OFFSET}`); }
export function addDays(date: string, days: number) { const value = instant(date); value.setUTCDate(value.getUTCDate() + days); return dateKey(value); }
export function weekday(date: string) { return instant(date).getUTCDay(); }
export function minutes(time: string) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
export function clock(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) { return new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, ...options }).format(typeof value === 'string' && value.length === 10 ? instant(value) : new Date(value)); }
export function formatTime(value: string) { return formatDate(value, { hour: 'numeric', minute: '2-digit' }); }
export function money(value: number) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value); }
export function weekStart(date: string) { return addDays(date, -(weekday(date) + 6) % 7); }
export function periodRange(date: string, period: string): [string, string] { if (period === 'day') return [date, date]; if (period === 'week') return [weekStart(date), addDays(weekStart(date), 6)]; const start = `${date.slice(0, 7)}-01`; const d = instant(start); d.setUTCMonth(d.getUTCMonth() + 1); return [start, addDays(dateKey(d), -1)]; }
export function addMonths(date: string, months: number) {
  const value = instant(`${date.slice(0, 7)}-01`);
  value.setUTCMonth(value.getUTCMonth() + months);
  const month = dateKey(value).slice(0, 7);
  const [, last] = periodRange(`${month}-01`, 'month');
  return `${month}-${String(Math.min(Number(date.slice(-2)), Number(last.slice(-2)))).padStart(2, '0')}`;
}
