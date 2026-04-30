import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiBotRoute = pathname.startsWith('/api/bots/')

  const isDashboard = pathname.startsWith('/dashboard')
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (!isDashboard && !isAuthPage && !isApiBotRoute) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  if ((isDashboard || isApiBotRoute) && !user) {
    if (isApiBotRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && user) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/bots/:path*',
    '/login',
    '/signup',
  ],
}

