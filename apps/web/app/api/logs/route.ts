import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const level = url.searchParams.get('level')

    let query = supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (level && level !== 'ALL') {
      query = query.eq('level', level)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Server error' }, { status: 500 })
  }
}

