import { Hono } from 'hono';

const wellknown = new Hono();

// Apple App Site Association for Universal Links
wellknown.get('/apple-app-site-association', (c) => {
  const teamId = process.env.APPLE_TEAM_ID || 'TEAM_ID';
  const appId = `${teamId}.com.spicypick.app`;

  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appId],
          paths: ['/scenario/*'],
          components: [
            {
              '/': '/scenario/*',
              comment: 'Matches scenario deep links',
            },
          ],
        },
      ],
    },
    webcredentials: {
      apps: [appId],
    },
  };

  return c.json(aasa, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});

// Android Asset Links for App Links
wellknown.get('/assetlinks.json', (c) => {
  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.spicypick.app',
        sha256_cert_fingerprints: [
          process.env.ANDROID_SHA256_FINGERPRINT ||
            'TODO:ADD_YOUR_SHA256_CERT_FINGERPRINT',
        ],
      },
    },
  ];

  return c.json(assetlinks, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});

export default wellknown;
