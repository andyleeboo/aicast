import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 100% sampling for hackathon — reduce in production
  tracesSampleRate: 1.0,

  // Auto-instrument @google/genai calls (model, tokens, latency)
  integrations: [Sentry.googleGenAIIntegration()],
});
