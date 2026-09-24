import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000'
const customerUrl = process.env.NEXT_PUBLIC_CUSTOMER_URL || 'http://localhost:3000'

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
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
