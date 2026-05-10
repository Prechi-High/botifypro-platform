import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const BOT_ENGINE_URL = process.env.BOT_ENGINE_URL || process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

export async function POST(request: Request) {
  // Verify admin session
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session || session.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { text, imageUrl, buttonText, buttonUrl, botId } = body

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    // Get list of bots to broadcast to
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    let botsQuery = supabase.from('bots').select('id').eq('is_active', true).eq('is_paused', false)
    if (botId) botsQuery = botsQuery.eq('id', botId)
    const { data: bots } = await botsQuery

    if (!bots || bots.length === 0) {
      return NextResponse.json({ success: true, sent: 0, failed: 0 })
    }

    let totalSent = 0
    let totalFailed = 0

    // Use existing per-bot broadcast endpoint
    for (const bot of bots) {
      try {
        const res = await fetch(`${BOT_ENGINE_URL}/api/bots/${bot.id}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, imageUrl, buttonText, buttonUrl }),
        })
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const data = await res.json()
          totalSent += data.sent || 0
          totalFailed += data.failed || 0
        }
      } catch {}
    }

    return NextResponse.json({ success: true, sent: totalSent, failed: totalFailed })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to send broadcast' }, { status: 500 })
  }
}
