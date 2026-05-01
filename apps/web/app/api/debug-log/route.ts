import { NextResponse } from 'next/server'
import { writeDebugLog } from '@/lib/debugFile'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    writeDebugLog(
      String(body?.scope || 'web-client'),
      String(body?.message || 'client-log'),
      typeof body?.data === 'object' && body?.data ? body.data : {}
    )
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to write debug log' }, { status: 500 })
  }
}
