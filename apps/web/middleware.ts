import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function withSupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })

  return target
}

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
      return withSupabaseCookies(response, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    const loginUrl = new URL('/login', request.url)
    return withSupabaseCookies(response, NextResponse.redirect(loginUrl))
  }

  if (isAuthPage && user) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return withSupabaseCookies(response, NextResponse.redirect(dashboardUrl))
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

