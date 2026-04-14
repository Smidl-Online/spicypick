import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { scenarios, scenarioSubmissions, reports, users } from '../db/schema.js';
import { eq, sql, desc, count } from 'drizzle-orm';
import { generateAndSaveScenario } from '../services/scenarioGenerator.js';
import { getAiConfig, setModelConfig, isAllowedModel, ALLOWED_MODELS, type AiUseCase } from '../services/aiClient.js';
import { VALID_CATEGORIES } from '../constants.js';
import { rateLimit } from '../middleware/rateLimit.js';

function safeEqual(a: string, b: string): boolean {
  // Hash both inputs to ensure constant-length comparison — prevents length-based timing leak
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COOKIE_SALT = 'spicypick-admin-v1';
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token + COOKIE_SALT).digest('hex');
}

const adminRoutes = new Hono();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Shared CSS ---
const CSS = `
  body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
  a { color: #7c83ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  nav { background: #16213e; padding: 12px 20px; margin: -20px -20px 20px; display: flex; gap: 20px; align-items: center; }
  nav a { color: #a0a0ff; font-weight: 600; }
  h1 { color: #fff; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #2a2a4a; }
  th { background: #16213e; color: #a0a0ff; }
  tr:hover { background: #16213e44; }
  .card { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .stat { font-size: 2rem; font-weight: 700; color: #7c83ff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
  form { margin-top: 16px; }
  input, select, textarea { background: #0f3460; color: #e0e0e0; border: 1px solid #2a2a4a; padding: 8px 12px; border-radius: 4px; width: 100%; box-sizing: border-box; }
  button { background: #7c83ff; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600; }
  button:hover { background: #5a60dd; }
  button.danger { background: #e74c3c; }
  button.danger:hover { background: #c0392b; }
  button.success { background: #27ae60; }
  button.success:hover { background: #1e8449; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
  .badge-draft { background: #f39c12; color: #000; }
  .badge-published { background: #27ae60; color: #fff; }
  .badge-scheduled { background: #3498db; color: #fff; }
  .badge-archived { background: #7f8c8d; color: #fff; }
  .badge-pending { background: #f39c12; color: #000; }
  .badge-approved { background: #27ae60; color: #fff; }
  .badge-rejected { background: #e74c3c; color: #fff; }
  .flash { padding: 12px; border-radius: 4px; margin-bottom: 16px; }
  .flash-success { background: #1e8449; }
  .flash-error { background: #c0392b; }
`;

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — SpicyPick Admin</title><style>${CSS}</style></head>
<body>
<nav>
  <strong style="color:#fff;">🌶 SpicyPick Admin</strong>
  <a href="/admin">Dashboard</a>
  <a href="/admin/scenarios">Scenarios</a>
  <a href="/admin/submissions">Submissions</a>
  <a href="/admin/reports">Reports</a>
  <a href="/admin/ai/config">AI Config</a>
</nav>
${content}
</body></html>`;
}

// --- Login route (before auth middleware, so it can accept POST with token in body) ---
adminRoutes.post('/login', rateLimit(5, 60_000), async (c) => {
  const envToken = process.env.ADMIN_TOKEN;
  if (!envToken) {
    return c.html('<h1>403 — ADMIN_TOKEN not configured</h1>', 403);
  }
  const formData = await c.req.parseBody();
  const token = formData.token as string;
  if (!token || !safeEqual(token, envToken)) {
    return c.html(layout('Login', `
      <div class="flash flash-error">Invalid token</div>
      <h1>Admin Login</h1>
      <div class="card">
        <form method="POST" action="/admin/login">
          <div style="margin-bottom:8px;"><label>Admin Token</label><input name="token" type="password" required></div>
          <button type="submit">Login</button>
        </form>
      </div>
    `), 403);
  }
  setCookie(c, 'admin_token', hashToken(envToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24,
    path: '/admin',
  });
  return c.redirect('/admin');
});

// --- Auth middleware ---
// Accepts token via: header "ADMIN_TOKEN" or cookie "admin_token"
adminRoutes.use('*', async (c, next) => {
  const envToken = process.env.ADMIN_TOKEN;
  if (!envToken) {
    return c.html('<h1>403 — ADMIN_TOKEN not configured</h1>', 403);
  }
  const headerToken = c.req.header('ADMIN_TOKEN');
  const cookieToken = getCookie(c, 'admin_token');
  // Header: compare raw token; Cookie: compare hashed token
  const authenticated = headerToken
    ? safeEqual(headerToken, envToken)
    : cookieToken
      ? safeEqual(cookieToken, hashToken(envToken))
      : false;
  if (!authenticated) {
    if (c.req.method === 'GET') {
      return c.html(layout('Login', `
        <h1>Admin Login</h1>
        <div class="card">
          <form method="POST" action="/admin/login">
            <div style="margin-bottom:8px;"><label>Admin Token</label><input name="token" type="password" required></div>
            <button type="submit">Login</button>
          </form>
        </div>
      `));
    }
    return c.html('<h1>403 — Forbidden</h1>', 403);
  }
  // Refresh cookie on each authenticated request
  setCookie(c, 'admin_token', hashToken(envToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24,
    path: '/admin',
  });
  await next();
});

// ============================
// GET /admin — Dashboard
// ============================
adminRoutes.get('/', async (c) => {
  const [scenarioStats] = await db.select({
    total: count(),
    drafts: sql<number>`count(*) filter (where ${scenarios.status} = 'draft')`,
    scheduled: sql<number>`count(*) filter (where ${scenarios.status} = 'scheduled')`,
    published: sql<number>`count(*) filter (where ${scenarios.status} = 'published')`,
    archived: sql<number>`count(*) filter (where ${scenarios.status} = 'archived')`,
  }).from(scenarios);

  const [userStats] = await db.select({ total: count() }).from(users);
  const [submissionStats] = await db.select({
    total: count(),
    pending: sql<number>`count(*) filter (where ${scenarioSubmissions.status} = 'pending')`,
  }).from(scenarioSubmissions);

  const content = `
    <h1>Dashboard</h1>
    <div class="grid">
      <div class="card"><div class="stat">${scenarioStats.total}</div>Scenarios total</div>
      <div class="card"><div class="stat">${scenarioStats.drafts}</div>Drafts</div>
      <div class="card"><div class="stat">${scenarioStats.scheduled}</div>Scheduled</div>
      <div class="card"><div class="stat">${scenarioStats.published}</div>Published</div>
      <div class="card"><div class="stat">${scenarioStats.archived}</div>Archived</div>
      <div class="card"><div class="stat">${userStats.total}</div>Users</div>
      <div class="card"><div class="stat">${submissionStats.pending}</div>Pending submissions</div>
    </div>
  `;
  return c.html(layout('Dashboard', content));
});

// ============================
// GET /admin/scenarios
// ============================
adminRoutes.get('/scenarios', async (c) => {
  const statusFilter = c.req.query('status');
  const whereClause = statusFilter ? eq(scenarios.status, statusFilter) : undefined;

  const allScenarios = await db.query.scenarios.findMany({
    where: whereClause,
    orderBy: [desc(scenarios.createdAt)],
    limit: 100,
  });

  const rows = allScenarios.map((s) => `
    <tr>
      <td>${escapeHtml(s.title)}</td>
      <td>${escapeHtml(s.category)}</td>
      <td><span class="badge badge-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
      <td>${s.publishDate || '—'}</td>
      <td>${s.totalVotes}</td>
      <td>${escapeHtml(s.source || '—')}</td>
      <td>
        <form method="POST" action="/admin/scenarios/${s.id}/status" style="display:inline;margin:0;">
          <select name="status" onchange="this.form.submit()">
            <option value="">Change…</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </form>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Scenarios</h1>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <a href="/admin/scenarios">All</a>
      <a href="/admin/scenarios?status=draft">Draft</a>
      <a href="/admin/scenarios?status=scheduled">Scheduled</a>
      <a href="/admin/scenarios?status=published">Published</a>
      <a href="/admin/scenarios?status=archived">Archived</a>
    </div>

    <div class="card">
      <h2>Create Scenario</h2>
      <form method="POST" action="/admin/scenarios">
        <div style="margin-bottom:8px;"><label>Title</label><input name="title" required maxlength="120"></div>
        <div style="margin-bottom:8px;"><label>Body</label><textarea name="body" rows="4" required maxlength="5000"></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
          <div><label>Category</label><select name="category">
            <option value="workplace">workplace</option>
            <option value="relationship">relationship</option>
            <option value="family">family</option>
            <option value="neighbors">neighbors</option>
            <option value="friends">friends</option>
            <option value="money">money</option>
          </select></div>
          <div><label>Publish Date</label><input name="publishDate" type="date"></div>
          <div><label>Status</label><select name="status">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select></div>
        </div>
        <button type="submit">Create Scenario</button>
      </form>
    </div>

    <div class="card" style="margin-top:16px;">
      <h2>AI Generate</h2>
      <form method="POST" action="/admin/scenarios/generate">
        <div style="display:flex;gap:8px;align-items:end;">
          <div><label>Category (optional)</label><select name="category">
            <option value="">Random</option>
            <option value="workplace">workplace</option>
            <option value="relationship">relationship</option>
            <option value="family">family</option>
            <option value="neighbors">neighbors</option>
            <option value="friends">friends</option>
            <option value="money">money</option>
          </select></div>
          <button type="submit">Generate with AI</button>
        </div>
      </form>
    </div>

    <table>
      <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Publish Date</th><th>Votes</th><th>Source</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return c.html(layout('Scenarios', content));
});

// ============================
// POST /admin/scenarios — Create
// ============================
const VALID_STATUSES = ['draft', 'scheduled', 'published'] as const;

const createScenarioSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  category: z.enum(VALID_CATEGORIES as unknown as [string, ...string[]]),
  publishDate: z.string().optional(),
  status: z.enum(VALID_STATUSES as unknown as [string, ...string[]]).default('draft'),
});

adminRoutes.post('/scenarios', async (c) => {
  const formData = await c.req.parseBody();
  const parsed = createScenarioSchema.safeParse(formData);
  if (!parsed.success) {
    return c.html(layout('Error', `<div class="flash flash-error">Invalid input: ${escapeHtml(JSON.stringify(parsed.error.flatten()))}</div><a href="/admin/scenarios">Back</a>`), 400);
  }
  const { title, body, category, publishDate, status } = parsed.data;
  await db.insert(scenarios).values({
    title,
    body,
    category,
    publishDate: publishDate || null,
    status,
    source: 'admin',
  });
  return c.redirect('/admin/scenarios');
});

// ============================
// POST /admin/scenarios/generate — AI Generate
// ============================
adminRoutes.post('/scenarios/generate', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const category = (formData.category as string) || undefined;
    if (category && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
      return c.html(layout('Error', `<div class="flash flash-error">Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}</div><a href="/admin/scenarios">Back</a>`), 400);
    }
    const saved = await generateAndSaveScenario(category);
    return c.html(layout('Generated', `
      <div class="flash flash-success">AI scenario generated successfully!</div>
      <div class="card">
        <h2>${escapeHtml(saved.title)}</h2>
        <p>${escapeHtml(saved.body)}</p>
        <p><strong>Category:</strong> ${escapeHtml(saved.category)} | <strong>Status:</strong> draft</p>
      </div>
      <a href="/admin/scenarios">Back to Scenarios</a>
    `));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.html(layout('Error', `<div class="flash flash-error">AI generation failed: ${escapeHtml(message)}</div><a href="/admin/scenarios">Back</a>`), 500);
  }
});

// ============================
// POST /admin/scenarios/:id/status — Update status
// ============================
adminRoutes.post('/scenarios/:id/status', async (c) => {
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.html(layout('Error', '<div class="flash flash-error">Invalid ID format</div>'), 400);
  const formData = await c.req.parseBody();
  const status = formData.status as string;
  if (!['draft', 'scheduled', 'published', 'archived'].includes(status)) {
    return c.html(layout('Error', '<div class="flash flash-error">Invalid status</div>'), 400);
  }
  const updateData: Record<string, unknown> = { status };
  if (status === 'published') {
    const existing = await db.query.scenarios.findFirst({ where: eq(scenarios.id, id) });
    if (existing && !existing.publishDate) {
      updateData.publishDate = new Date().toISOString().split('T')[0];
    }
  }
  await db.update(scenarios).set(updateData).where(eq(scenarios.id, id));
  return c.redirect('/admin/scenarios');
});

// ============================
// GET /admin/submissions
// ============================
adminRoutes.get('/submissions', async (c) => {
  const allSubmissions = await db.query.scenarioSubmissions.findMany({
    orderBy: [desc(scenarioSubmissions.createdAt)],
    limit: 100,
  });

  const rows = allSubmissions.map((s) => `
    <tr>
      <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.body.substring(0, 200))}${s.body.length > 200 ? '…' : ''}</td>
      <td><span class="badge badge-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
      <td>${new Date(s.createdAt).toLocaleDateString()}</td>
      <td>${escapeHtml(s.moderatorNotes || '—')}</td>
      <td>
        ${s.status === 'pending' ? `
          <form method="POST" action="/admin/submissions/${s.id}/approve" style="display:inline;margin:0;">
            <select name="category" style="width:auto;display:inline;padding:4px;">
              ${VALID_CATEGORIES.map((cat) => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
            <button type="submit" class="success" style="padding:4px 10px;font-size:0.85rem;">Approve</button>
          </form>
          <form method="POST" action="/admin/submissions/${s.id}/reject" style="display:inline;margin:0;">
            <input name="moderatorNotes" placeholder="Reason…" maxlength="500" style="width:120px;display:inline;padding:4px;">
            <button type="submit" class="danger" style="padding:4px 10px;font-size:0.85rem;">Reject</button>
          </form>
        ` : ''}
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>User Submissions</h1>
    <table>
      <thead><tr><th>Body</th><th>Status</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return c.html(layout('Submissions', content));
});

// ============================
// POST /admin/submissions/:id/approve
// ============================
adminRoutes.post('/submissions/:id/approve', async (c) => {
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.html(layout('Error', '<div class="flash flash-error">Invalid ID format</div>'), 400);

  const formData = await c.req.parseBody();
  const category = formData.category as string;
  if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return c.html(layout('Error', `<div class="flash flash-error">Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}</div><a href="/admin/submissions">Back</a>`), 400);
  }

  const result = await db.transaction(async (tx) => {
    const submission = await tx.query.scenarioSubmissions.findFirst({
      where: eq(scenarioSubmissions.id, id),
    });
    if (!submission) return { error: 'not_found' as const };
    if (submission.status !== 'pending') return { error: 'already_processed' as const, status: submission.status };

    await tx.insert(scenarios).values({
      title: submission.body.substring(0, 120),
      body: submission.body,
      category,
      source: 'user_submission',
      status: 'draft',
    });

    await tx.update(scenarioSubmissions).set({
      status: 'approved',
      moderatorNotes: 'Approved and converted to scenario draft.',
    }).where(eq(scenarioSubmissions.id, id));

    return { error: null };
  });

  if (result.error === 'not_found') return c.html(layout('Error', '<div class="flash flash-error">Submission not found</div>'), 404);
  if (result.error === 'already_processed') {
    return c.html(layout('Error', `<div class="flash flash-error">Submission already ${escapeHtml(result.status!)}</div><a href="/admin/submissions">Back</a>`), 409);
  }

  return c.redirect('/admin/submissions');
});

// ============================
// POST /admin/submissions/:id/reject
// ============================
adminRoutes.post('/submissions/:id/reject', async (c) => {
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.html(layout('Error', '<div class="flash flash-error">Invalid ID format</div>'), 400);

  const formData = await c.req.parseBody();
  const rawNotes = (formData.moderatorNotes as string) || 'Rejected by moderator.';
  const moderatorNotes = rawNotes.substring(0, 500);

  const result = await db.transaction(async (tx) => {
    const submission = await tx.query.scenarioSubmissions.findFirst({
      where: eq(scenarioSubmissions.id, id),
    });
    if (!submission) return { error: 'not_found' as const };
    if (submission.status !== 'pending') return { error: 'already_processed' as const, status: submission.status };

    await tx.update(scenarioSubmissions).set({
      status: 'rejected',
      moderatorNotes,
    }).where(eq(scenarioSubmissions.id, id));

    return { error: null };
  });

  if (result.error === 'not_found') return c.html(layout('Error', '<div class="flash flash-error">Submission not found</div>'), 404);
  if (result.error === 'already_processed') {
    return c.html(layout('Error', `<div class="flash flash-error">Submission already ${escapeHtml(result.status!)}</div><a href="/admin/submissions">Back</a>`), 409);
  }

  return c.redirect('/admin/submissions');
});

// ============================
// GET /admin/reports
// ============================
adminRoutes.get('/reports', async (c) => {
  const reportedScenarios = await db
    .select({
      scenarioId: reports.scenarioId,
      reportCount: count(),
      title: scenarios.title,
      category: scenarios.category,
      status: scenarios.status,
    })
    .from(reports)
    .innerJoin(scenarios, eq(reports.scenarioId, scenarios.id))
    .groupBy(reports.scenarioId, scenarios.title, scenarios.category, scenarios.status)
    .orderBy(desc(count()));

  const rows = reportedScenarios.map((r) => `
    <tr>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td><span class="badge badge-${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td>
      <td style="font-weight:700;color:#e74c3c;">${r.reportCount}</td>
      <td>
        <form method="POST" action="/admin/scenarios/${r.scenarioId}/status" style="display:inline;margin:0;">
          <input type="hidden" name="status" value="archived">
          <button type="submit" class="danger" style="padding:4px 10px;font-size:0.85rem;">Archive</button>
        </form>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>Reported Scenarios</h1>
    <table>
      <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Reports</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return c.html(layout('Reports', content));
});

// ============================
// GET /admin/ai/config — View AI model configuration
// ============================
adminRoutes.get('/ai/config', async (c) => {
  const acceptJson = c.req.header('Accept')?.includes('application/json');
  const config = await getAiConfig();

  if (acceptJson) {
    return c.json({ config, allowedModels: ALLOWED_MODELS });
  }

  const useCaseLabels: Record<AiUseCase, string> = {
    generation: 'Scenario Generation',
    moderation: 'Content Moderation',
    analysis: 'Expert Analysis',
  };

  const sourceLabels: Record<string, string> = {
    database: 'Database (admin override)',
    env: 'Environment variable (per use-case)',
    env_generic: 'Environment variable (AI_MODEL)',
    default: 'Default',
  };

  const rows = (Object.entries(config) as [AiUseCase, { model: string; source: string }][]).map(([useCase, cfg]) => `
    <tr>
      <td><strong>${useCaseLabels[useCase]}</strong></td>
      <td><code>${escapeHtml(cfg.model)}</code></td>
      <td>${sourceLabels[cfg.source] || cfg.source}</td>
      <td>
        <form method="POST" action="/admin/ai/config" style="display:flex;gap:8px;margin:0;">
          <input type="hidden" name="useCase" value="${useCase}">
          <select name="model" style="width:auto;">
            ${ALLOWED_MODELS.map((m) => `<option value="${m}" ${m === cfg.model ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <button type="submit" style="padding:4px 12px;font-size:0.85rem;">Set</button>
        </form>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1>AI Model Configuration</h1>
    <div class="card">
      <p>Configure which AI model is used for each use-case. Changes take effect within 1 minute (cached).</p>
      <table>
        <thead><tr><th>Use Case</th><th>Current Model</th><th>Source</th><th>Change</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="card" style="margin-top:16px;">
      <h2>Allowed Models</h2>
      <ul>${ALLOWED_MODELS.map((m) => `<li><code>${m}</code></li>`).join('')}</ul>
    </div>
  `;
  return c.html(layout('AI Config', content));
});

// ============================
// POST /admin/ai/config — Update AI model (HTML form)
// ============================
adminRoutes.post('/ai/config', async (c) => {
  const formData = await c.req.parseBody();
  const useCase = formData.useCase as string;
  const model = formData.model as string;

  const validUseCases = ['generation', 'moderation', 'analysis'];
  if (!validUseCases.includes(useCase)) {
    return c.html(layout('Error', '<div class="flash flash-error">Invalid use case</div><a href="/admin/ai/config">Back</a>'), 400);
  }
  if (!model || !isAllowedModel(model)) {
    return c.html(layout('Error', `<div class="flash flash-error">Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}</div><a href="/admin/ai/config">Back</a>`), 400);
  }

  await setModelConfig(useCase as AiUseCase, model);
  return c.redirect('/admin/ai/config');
});

// ============================
// PATCH /admin/ai/config — Update AI model (JSON API)
// ============================
adminRoutes.patch('/ai/config', async (c) => {
  const body = await c.req.json() as Record<string, string>;
  const validUseCases = ['generation', 'moderation', 'analysis'] as AiUseCase[];
  const updated: Record<string, string> = {};

  for (const useCase of validUseCases) {
    const model = body[useCase];
    if (model !== undefined) {
      if (!isAllowedModel(model)) {
        return c.json({ error: `Invalid model "${model}" for ${useCase}. Allowed: ${ALLOWED_MODELS.join(', ')}` }, 400);
      }
      await setModelConfig(useCase, model);
      updated[useCase] = model;
    }
  }

  const config = await getAiConfig();
  return c.json({ updated, config });
});

export default adminRoutes;
