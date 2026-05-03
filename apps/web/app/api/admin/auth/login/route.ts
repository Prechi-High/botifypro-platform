import { NextResponse } from 'next/server'
import { prisma } from '@botifypro/database'
import { cookies } from 'next/headers'
import { verifyAdminPassword, ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE } from '@/lib/adminAuth'

const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const settings = await prisma.platformSettings.findFirst()
    const storedHash = (settings as any)?.adminPassword || ''

    if (!verifyAdminPassword(password, storedHash)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 500 })
  }
}
