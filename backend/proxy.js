import { NextResponse } from 'next/server'

/**
 * Next.js 16 Framework Middleware / Proxy:
 * Note: Next.js 16 deprecated `middleware.js` in favor of `proxy.js` (Node.js runtime).
 * This file serves as the framework-level network boundary and CORS middleware for all `/api/:path*` routes.
 */
export function proxy(request) {
  const response = NextResponse.next()
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001',
    process.env.SUPERADMIN_URL || 'http://localhost:3002',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ]

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers })
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}

export default proxy
