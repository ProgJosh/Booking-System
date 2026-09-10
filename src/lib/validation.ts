import { z } from 'zod';
export const nameSchema = z.string().trim().min(2, 'Please enter at least 2 characters.').max(100);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));
export const phoneSchema = z.string().trim().regex(/^[+()\d\s.-]{7,25}$/, 'Enter a valid phone number.').refine(value => value.replace(/\D/g, '').length >= 7, 'Enter a phone number with at least 7 digits.');
export const profileSchema = z.object({ name: nameSchema, email: emailSchema, phone: phoneSchema });
export const registerSchema = profileSchema.extend({ password: z.string().min(8, 'Use a password with at least 8 characters.').max(128) });
export const serviceSchema = z.object({ id: z.string(), name: nameSchema, description: z.string().trim().min(10, 'Add a description of at least 10 characters.').max(500), duration: z.number().int().min(15).max(240).multipleOf(15, 'Duration must be in 15-minute increments.'), price: z.number().min(0).max(10000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Use no more than two decimal places for prices.'), active: z.boolean(), color: z.string() });
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').refine(v => { const d = new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Enter a valid calendar date.');
export const bookingSchema = z.object({ customerId: z.string().min(1), serviceId: z.string().min(1), staffId: z.string().min(1), date: dateSchema, time: timeSchema, notes: z.string().max(1000) });
export function errorMessage(error: unknown) { return error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
