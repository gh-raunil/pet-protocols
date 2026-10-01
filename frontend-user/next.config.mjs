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
const defaultAdmin = isDev ? 'http://localhost:3001' : 'https://pet-protocols-restaurant.vercel.app'
const defaultSuperadmin = isDev ? 'http://localhost:3002' : 'https://pet-protocols-superadmin.vercel.app'

const backendUrl = normalizeUrl(process.env.BACKEND_INTERNAL_URL, defaultBackend)
const adminUrl = normalizeUrl(process.env.NEXT_PUBLIC_ADMIN_URL, defaultAdmin)
const superadminUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPERADMIN_URL, defaultSuperadmin)

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
  async redirects() {
    return [
      {
        source: '/restaurant',
        destination: `${adminUrl}/dashboard`,
        permanent: false,
      },
      {
        source: '/restaurant/:path*',
        destination: `${adminUrl}/:path*`,
        permanent: false,
      },
      {
        source: '/superadmin',
        destination: `${superadminUrl}/`,
        permanent: false,
      },
      {
        source: '/superadmin/:path*',
        destination: `${superadminUrl}/:path*`,
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path(sw\\.js|service-worker\\.js)',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
      {
        source: '/downloads/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/vnd.android.package-archive',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig

