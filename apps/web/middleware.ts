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
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && hasSession) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
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

