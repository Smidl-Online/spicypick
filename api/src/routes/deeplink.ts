import { Hono } from 'hono';
import { html } from 'hono/html';
import { db } from '../db/index.js';
import { scenarios } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const deeplink = new Hono();

const APP_STORE_URL = 'https://apps.apple.com/app/spicypick/id0000000000';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.spicypick.app';
const APP_SCHEME = 'spicypick';

function renderFallbackPage(
  scenarioId: string,
  title?: string,
  body?: string,
) {
  const appLink = `${APP_SCHEME}://scenario/${scenarioId}`;
  const universalLink = `https://spicypick.app/scenario/${scenarioId}`;
  const ogTitle = title || 'SpicyPick — Daily Moral Dilemma';
  const ogDescription =
    body?.slice(0, 160) || 'Can you handle the spiciest moral dilemma of the day?';

  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${ogTitle}</title>

        <!-- Open Graph -->
        <meta property="og:title" content="${ogTitle}" />
        <meta property="og:description" content="${ogDescription}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${universalLink}" />
        <meta property="og:image" content="https://spicypick.app/og-image.png" />
        <meta property="og:site_name" content="SpicyPick" />

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${ogTitle}" />
        <meta name="twitter:description" content="${ogDescription}" />
        <meta name="twitter:image" content="https://spicypick.app/og-image.png" />

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
              sans-serif;
            background: #1a1a2e;
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            text-align: center;
            padding: 2rem;
            max-width: 480px;
          }
          .logo {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            color: #e94560;
          }
          p {
            color: #ccc;
            margin-bottom: 2rem;
            line-height: 1.5;
          }
          .buttons {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          .btn {
            display: block;
            padding: 0.875rem 1.5rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            transition: opacity 0.2s;
          }
          .btn:hover {
            opacity: 0.85;
          }
          .btn-primary {
            background: #e94560;
            color: #fff;
          }
          .btn-ios {
            background: #333;
            color: #fff;
          }
          .btn-android {
            background: #333;
            color: #fff;
          }
          .divider {
            color: #666;
            margin: 0.25rem 0;
            font-size: 0.875rem;
          }
        </style>

        <script>
          (function () {
            var appLink = '${appLink}';
            var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
            var isAndroid = /Android/.test(navigator.userAgent);

            if (isIOS || isAndroid) {
              // Try to open the app
              window.location.href = appLink;

              // If app not installed, redirect to store after delay
              setTimeout(function () {
                if (document.hidden || document.webkitHidden) return;
                window.location.href = isIOS
                  ? '${APP_STORE_URL}'
                  : '${PLAY_STORE_URL}';
              }, 1500);
            }
          })();
        </script>
      </head>
      <body>
        <div class="container">
          <div class="logo">🌶️</div>
          <h1>${ogTitle}</h1>
          <p>${ogDescription}</p>
          <div class="buttons">
            <a href="${appLink}" class="btn btn-primary">Open in SpicyPick</a>
            <div class="divider">or download the app</div>
            <a href="${APP_STORE_URL}" class="btn btn-ios">
              🍎 Download on App Store
            </a>
            <a href="${PLAY_STORE_URL}" class="btn btn-android">
              🤖 Get it on Google Play
            </a>
          </div>
        </div>
      </body>
    </html>`;
}

// Scenario deep link fallback page
deeplink.get('/scenario/:id', async (c) => {
  const scenarioId = c.req.param('id');

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(scenarioId)) {
    return c.html(renderFallbackPage(scenarioId), 200);
  }

  // Try to fetch scenario metadata for OG tags
  try {
    const [scenario] = await db
      .select({ title: scenarios.title, body: scenarios.body })
      .from(scenarios)
      .where(eq(scenarios.id, scenarioId))
      .limit(1);

    if (scenario) {
      return c.html(
        renderFallbackPage(scenarioId, scenario.title, scenario.body),
        200,
      );
    }
  } catch {
    // DB error — still render fallback
  }

  return c.html(renderFallbackPage(scenarioId), 200);
});

export default deeplink;
