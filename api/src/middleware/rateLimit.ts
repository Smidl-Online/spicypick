import { Context, Next } from 'hono';

const requests = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (maxRequests: number = 60, windowMs: number = 60_000) => {
  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now > entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    entry.count++;
    await next();
  };
};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) {
      requests.delete(key);
    }
  }
}, 300_000);
