import * as Sentry from '@sentry/react-native';

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not configured, skipping');
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext('extra', context);
  }
  Sentry.captureException(error);
}

export { Sentry };
