/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig
