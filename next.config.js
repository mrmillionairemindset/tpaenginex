/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — emits .next/standalone with minimal node_modules for Docker/containers
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty', 'pdfkit'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle PDFKit on the server
      config.externals = [...(config.externals || []), 'pdfkit'];
    }
    return config;
  },
}

// Wrap with Sentry for error monitoring. No-op when SENTRY_DSN is unset.
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: true,
  // Organization/project from Sentry dashboard (required for source map upload in CI)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI
  dryRun: process.env.CI !== 'true',
}, {
  // Use a tunnel route to avoid ad-blockers (client-side events go through /monitoring)
  tunnelRoute: '/monitoring',
  // Hides source maps from public access
  hideSourceMaps: true,
  // Disable Sentry CLI telemetry
  telemetry: false,
  // Automatically tree-shake Sentry logger statements in production
  disableLogger: true,
});
