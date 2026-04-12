import { Context, Next } from 'hono';

export const rateLimit = (maxRequests: number = 60, windowMs: number = 60_000, store?: Map<string, { count: number; resetAt: number }>) => {
  const requests = store ?? new Map<string, { count: number; resetAt: number }>();

  // Cleanup old entries every 5 minutes — only when we own the Map (no external store)
  if (!store) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of requests) {
        if (now > entry.resetAt) {
          requests.delete(key);
        }
      }
    }, 300_000).unref();
  }

  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'unknown';
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
