'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Plus, AlertCircle } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function BotsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bots, setBots] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) throw new Error('Not authenticated')

        const { data, error: botsErr } = await supabase
          .from('bots')
          .select('id, bot_name, bot_username, is_active, webhook_set, category, platform_admin_confirmed, created_at')
          .eq('creator_id', userId)
          .order('created_at', { ascending: false })

        if (botsErr) throw botsErr
        if (cancelled) return
        setBots(data || [])
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load bots'
        setError(message)
        toast.error(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bots</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your Telegram bots.</p>
        </div>
        <Link
          href="/dashboard/bots/add"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={18} />
          Add bot
        </Link>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Bot size={18} />
          Your bots
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-sm text-gray-600">Loading...</div>
          ) : bots.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No bots yet.</div>
          ) : (
            bots.map((b) => (
              <div key={b.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{b.bot_name || 'Unnamed bot'}</div>
                  <div className="text-sm text-gray-600">
                    {b.bot_username ? '@' + String(b.bot_username).replace('@', '') : 'No username'} · Category:{' '}
                    {b.category}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      'text-xs font-medium px-2 py-1 rounded-full ' +
                      (b.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-700 border border-gray-200')
                    }
                  >
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Link
                    href={`/dashboard/bots/${b.id}/settings`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

