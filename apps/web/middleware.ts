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
  const userPresent = Boolean(user)

  // #region agent log
  fetch('http://127.0.0.1:7640/ingest/f8d22ce6-9d74-4edb-bee6-4fc8cfd0ca00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93c4ff'},body:JSON.stringify({sessionId:'93c4ff',runId:'login-debug',hypothesisId:'H3',location:'middleware.ts:25',message:'Middleware evaluated request',data:{pathname,isDashboard,isAuthPage,isApiBotRoute,userPresent},timestamp:Date.now()})}).catch(()=>{})
  // #endregion

  if ((isDashboard || isApiBotRoute) && !user) {
    if (isApiBotRoute) {
      // #region agent log
      fetch('http://127.0.0.1:7640/ingest/f8d22ce6-9d74-4edb-bee6-4fc8cfd0ca00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93c4ff'},body:JSON.stringify({sessionId:'93c4ff',runId:'login-debug',hypothesisId:'H3',location:'middleware.ts:31',message:'Middleware returning API unauthorized',data:{pathname,userPresent:false},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return withSupabaseCookies(response, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    const loginUrl = new URL('/login', request.url)
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/f8d22ce6-9d74-4edb-bee6-4fc8cfd0ca00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93c4ff'},body:JSON.stringify({sessionId:'93c4ff',runId:'login-debug',hypothesisId:'H3',location:'middleware.ts:36',message:'Middleware redirecting to login',data:{pathname,userPresent:false},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return withSupabaseCookies(response, NextResponse.redirect(loginUrl))
  }

  if (isAuthPage && user) {
    const dashboardUrl = new URL('/dashboard', request.url)
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/f8d22ce6-9d74-4edb-bee6-4fc8cfd0ca00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93c4ff'},body:JSON.stringify({sessionId:'93c4ff',runId:'login-debug',hypothesisId:'H4',location:'middleware.ts:43',message:'Middleware redirecting authenticated user to dashboard',data:{pathname,userPresent:true},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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

