/** @type {import('next').NextConfig} */
function normalizeUrl(url, fallback) {
  let val = (url || fallback || '').trim()
  if (!val) return fallback
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    val = `https://${val}`
  }
  return val.replace(/\/+$/, '')
}

const isDev = process.env.NODE_ENV === 'development'
const defaultBackend = isDev ? 'http://127.0.0.1:4000' : 'https://pet-protocols-backend.vercel.app'
const backendUrl = normalizeUrl(process.env.BACKEND_INTERNAL_URL, defaultBackend)

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/restaurant',
        destination: '/dashboard',
      },
      {
        source: '/restaurant/:path*',
        destination: '/:path*',
      },
    ]
  },
}

export default nextConfig

