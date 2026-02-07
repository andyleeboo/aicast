import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 100% sampling for hackathon — reduce in production
  tracesSampleRate: 1.0,

  // Capture 100% of sessions with errors for replay
  replaysOnErrorSampleRate: 1.0,
  // Sample 10% of all sessions for replay
  replaysSessionSampleRate: 0.1,

  integrations: [Sentry.replayIntegration()],
});
