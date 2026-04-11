import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '../middleware/rateLimit.js';

describe('rate limiting', () => {
  it('should allow requests under the limit', async () => {
    const store = new Map();
    const app = new Hono();
    app.use('*', rateLimit(5, 60000, store));
    app.get('/test', (c) => c.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    }
  });

  it('should block requests over the limit', async () => {
    const store = new Map();
    const app = new Hono();
    app.use('*', rateLimit(3, 60000, store));
    app.get('/test', (c) => c.json({ ok: true }));

    // Exhaust limit
    for (let i = 0; i < 3; i++) {
      await app.request('/test');
    }

    const res = await app.request('/test');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many');
  });
});
