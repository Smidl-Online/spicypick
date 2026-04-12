import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });

  console.log('Sentry initialized');
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext('extra', context);
  }
  Sentry.captureException(error);
}
