/** @type {import('next').NextConfig} */
function normalizeUrl(url, fallback) {
  let val = (url || fallback || '').trim()
  if (!val) return fallback
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    val = `https://${val}`
  }
  return val.replace(/\/+$/, '')
}

const backendUrl = normalizeUrl(process.env.BACKEND_INTERNAL_URL, 'http://127.0.0.1:4000')
const adminUrl = normalizeUrl(process.env.NEXT_PUBLIC_ADMIN_URL, 'http://localhost:3001')
const superadminUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPERADMIN_URL, 'http://localhost:3002')

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

