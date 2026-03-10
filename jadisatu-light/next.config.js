/** @type {import('next').NextConfig} */
const nextConfig = {
  generateEtags: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' }
        ]
      }
    ]
  }
}
module.exports = nextConfig
