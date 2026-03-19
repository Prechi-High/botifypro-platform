'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Plus, AlertCircle, Settings, Terminal, Users } from 'lucide-react'
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
              <div key={b.id} style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#1f2937', marginBottom: '4px' }}>
                    {b.bot_name || 'Unnamed bot'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {b.bot_username ? '@' + String(b.bot_username).replace('@', '') : 'No username'} · Category:{' '}
                    {b.category}
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <a 
                    href={`/dashboard/bots/${b.id}/settings`} 
                    style={{
                      padding: '7px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Settings size={13} />Settings
                  </a>
                  <a 
                    href={`/dashboard/bots/${b.id}/commands`} 
                    style={{
                      padding: '7px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Terminal size={13} />Commands
                  </a>
                  <a 
                    href={`/dashboard/bots/${b.id}/users`} 
                    style={{
                      padding: '7px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Users size={13} />Users
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

