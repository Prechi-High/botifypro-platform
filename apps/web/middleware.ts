import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isDashboard = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminLogin = pathname === '/admin/login'

  // ── Admin route protection ────────────────────────────────────────────────
  if (isAdminRoute && !isAdminLogin) {
    const adminSession = request.cookies.get('admin_session')
    if (!adminSession || adminSession.value !== 'authenticated') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  // If already logged in as admin and visiting login page, redirect to admin
  if (isAdminLogin) {
    const adminSession = request.cookies.get('admin_session')
    if (adminSession?.value === 'authenticated') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  // ── Dashboard route protection ────────────────────────────────────────────
  if (!isDashboard && !isAuthPage) {
    return NextResponse.next()
  }

  const cookies = request.cookies
  let hasSession = false

  cookies.getAll().forEach((cookie) => {
    if (cookie.name.includes('auth-token') || cookie.name.includes('supabase')) {
      if (cookie.value && cookie.value.length > 50) {
        hasSession = true
      }
    }
  })

  if (isDashboard && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && hasSession) {
    const redirect = request.nextUrl.searchParams.get('redirect')
    const dest = redirect && redirect.startsWith('/dashboard') ? redirect : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
}
