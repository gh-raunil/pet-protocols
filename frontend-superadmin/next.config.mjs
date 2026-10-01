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
const defaultCustomer = isDev ? 'http://localhost:3000' : 'https://pet-protocols.vercel.app'

const backendUrl = normalizeUrl(process.env.BACKEND_INTERNAL_URL, defaultBackend)
const customerUrl = normalizeUrl(process.env.NEXT_PUBLIC_CUSTOMER_URL, defaultCustomer)

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
        source: '/superadmin',
        destination: '/',
      },
      {
        source: '/superadmin/:path*',
        destination: '/:path*',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/menu',
        destination: `${customerUrl}/menu`,
        permanent: false,
      },
      {
        source: '/menu/:path*',
        destination: `${customerUrl}/menu/:path*`,
        permanent: false,
      },
    ]
  },
}

export default nextConfig

