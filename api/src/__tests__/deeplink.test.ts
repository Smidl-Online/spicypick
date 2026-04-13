import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

// Mock DB before importing routes
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [
            { title: 'Test Scenario', body: 'A test scenario body text.' },
          ]),
        })),
      })),
    })),
  },
}));

import wellknownRoutes from '../routes/wellknown.js';
import deeplinkRoutes from '../routes/deeplink.js';

describe('well-known routes', () => {
  const app = new Hono();
  app.route('/.well-known', wellknownRoutes);

  it('should return apple-app-site-association JSON', async () => {
    const res = await app.request('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.applinks).toBeDefined();
    expect(data.applinks.details).toHaveLength(1);
    expect(data.applinks.details[0].paths).toContain('/scenario/*');
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('should return assetlinks.json', async () => {
    const res = await app.request('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].relation).toContain(
      'delegate_permission/common.handle_all_urls',
    );
    expect(data[0].target.package_name).toBe('com.spicypick.app');
  });
});

describe('deep link fallback routes', () => {
  const app = new Hono();
  app.route('/', deeplinkRoutes);

  it('should return HTML fallback page for scenario deep link', async () => {
    const scenarioId = '12345678-1234-1234-1234-123456789abc';
    const res = await app.request(`/scenario/${scenarioId}`);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('SpicyPick');
    expect(html).toContain(scenarioId);
    expect(html).toContain('spicypick://scenario/');
    expect(html).toContain('apps.apple.com');
    expect(html).toContain('play.google.com');
    // OG tags from mocked scenario
    expect(html).toContain('Test Scenario');
  });

  it('should handle invalid scenario ID gracefully', async () => {
    const res = await app.request('/scenario/not-a-uuid');
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('SpicyPick');
    expect(html).toContain('Open in SpicyPick');
  });
});
