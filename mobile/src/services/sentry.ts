import * as Sentry from '@sentry/react-native';

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not configured, skipping');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    // Performance: trace navigation
    integrations: [Sentry.reactNativeTracingIntegration()],
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
