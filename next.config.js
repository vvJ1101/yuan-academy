/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep React-PDF 10 compatible with this project's pre-15 Next.js compiler.
  swcMinify: false,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'xlsx', 'tesseract.js'],
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
}

module.exports = nextConfig
