import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/orders') ||
    request.nextUrl.pathname.startsWith('/checkout')

  if (!token && (isAdminRoute || isProtectedRoute)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isAdminRoute && token?.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/profile/:path*',
    '/orders/:path*',
    '/checkout/:path*'
  ]
}