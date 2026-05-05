/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath removed — Next.js is now served at root /
  // (previously at /light; dark mode moved to /dark)
  // Enable etags for efficient caching
  generateEtags: true,
  // Compress responses
  compress: true,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Granular cache headers
  async headers() {
    return [
      // Static assets — cache aggressively (hashed filenames = safe to cache forever)
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      // API routes — no cache (dynamic data)
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' }
        ]
      },
      // Pages — allow browser cache with revalidation
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, must-revalidate' }
        ]
      }
    ]
  },
  // Tree-shake heavy icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
}
module.exports = nextConfig
