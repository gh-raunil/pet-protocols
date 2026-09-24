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
const customerUrl = normalizeUrl(process.env.NEXT_PUBLIC_CUSTOMER_URL, 'http://localhost:3000')

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

