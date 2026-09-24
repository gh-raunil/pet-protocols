import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000'
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'
const superadminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL || 'http://localhost:3002'

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
