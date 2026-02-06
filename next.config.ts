import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "nantestudio",
  project: "aicast",

  // Only log source map upload info in CI
  silent: !process.env.CI,

  // Include dependency source maps for complete stack traces
  widenClientFileUpload: true,
});
