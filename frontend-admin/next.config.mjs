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
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url, Accept' },
        ],
      },
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
    ]
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

