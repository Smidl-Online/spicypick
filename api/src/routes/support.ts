import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { AppEnv } from '../types.js';
import { sendSupportEmail } from '../services/email.js';
import { rateLimit } from '../middleware/rateLimit.js';

const supportRoutes = new Hono<AppEnv>();

// Per-user rate limit store: 3 messages/hour.
// NOTE: This store is process-local (in-memory). For single-instance deployments this is sufficient;
// a shared backing store (Redis etc.) would be needed for multi-instance setups.
const supportRateLimitStore = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of supportRateLimitStore) {
    if (now > entry.resetAt) supportRateLimitStore.delete(key);
  }
}, 300_000).unref();

const contactSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

// POST /api/support/contact
supportRoutes.post('/contact', authMiddleware, async (c) => {
  const userId = c.get('userId');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { subject, message } = parsed.data;

  // Per-user rate limit: 3 requests/hour — checked after validation to avoid burning quota on bad input.
  // Rate limit is checked here but incremented only after a successful send, so failed sends
  // (Resend down, misconfigured SUPPORT_EMAIL) do not consume the user's quota.
  const now = Date.now();
  const entry = supportRateLimitStore.get(userId);
  if (entry && now <= entry.resetAt && entry.count >= 3) {
    return c.json({ error: 'Too many requests. Please wait before sending another message.' }, 429);
  }

  const userEmail = c.get('email') as string | undefined;

  try {
    await sendSupportEmail({ userId, userEmail, subject, message });
  } catch (err: any) {
    if (err?.message === 'SUPPORT_EMAIL is not configured') {
      console.error('SUPPORT_EMAIL is not configured');
      return c.json({ error: 'Support contact is not available' }, 503);
    }
    console.error('Failed to send support email:', err);
    return c.json({ error: 'Failed to send message. Please try again.' }, 500);
  }

  // Increment quota only after successful send
  if (entry && now <= entry.resetAt) {
    entry.count++;
  } else {
    supportRateLimitStore.delete(userId);
    supportRateLimitStore.set(userId, { count: 1, resetAt: now + 3_600_000 });
  }

  return c.json({ message: 'Your message has been sent. We will get back to you soon.' });
});

export default supportRoutes;
