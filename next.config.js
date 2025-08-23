/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // DO NOT set `output: 'export'` — that would remove API routes.
  // If you want smaller server bundles, you can use:
  // output: 'standalone',
};

module.exports = nextConfig;
