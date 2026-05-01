import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isDashboard = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/login' || pathname === '/signup'

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
    // Preserve the intended destination so we can redirect back after login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && hasSession) {
    // If already logged in and visiting auth page, check for redirect param
    const redirect = request.nextUrl.searchParams.get('redirect')
    const dest = redirect && redirect.startsWith('/dashboard') ? redirect : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
  ],
}
