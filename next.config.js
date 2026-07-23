/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['better-sqlite3', 'xlsx', 'tesseract.js'],
  images: {
    formats: ['image/webp', 'image/avif'],
  }
}

module.exports = nextConfig
