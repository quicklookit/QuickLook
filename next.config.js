// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // IMPORTANT: do NOT use output: 'export' here, that removes API routes.
  // If you previously had it, delete it.
  // If you want smaller server bundles, you can use:
  // output: 'standalone',
};

module.exports = nextConfig;
