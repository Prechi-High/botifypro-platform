'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Plus, AlertCircle, Settings, Terminal, Users, Zap, ChevronRight } from 'lucide-react'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>My Bots</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} />
            Manage your Telegram bots.
          </p>
        </div>
        <Link
          href="/dashboard/bots/add"
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <Plus size={18} />
          Add Bot
        </Link>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px',
          padding: '12px',
          color: '#FCA5A5',
          fontSize: '13px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={18} style={{ marginTop: '1px' }} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                height: '120px'
              }}
            />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '36px',
          textAlign: 'center'
        }}>
          <Bot size={48} color="#3B82F6" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>No bots yet</h3>
          <p style={{ margin: '8px 0 18px', fontSize: '14px', color: 'var(--text-secondary)' }}>Add your first bot</p>
          <Link href="/dashboard/bots/add" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <Plus size={16} />
            Add Bot
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {bots.map((b) => (
            <div
              key={b.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '20px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'
                e.currentTarget.style.background = 'rgba(59,130,246,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bot size={20} color="#fff" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.bot_name || 'Unnamed bot'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.bot_username ? '@' + String(b.bot_username).replace('@', '') : 'No username'}
                    </div>
                  </div>
                </div>
                <span className={b.is_active ? 'badge-active' : 'badge-inactive'}>{b.is_active ? 'Active' : 'Inactive'}</span>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)'
                }}>
                  {b.category || 'general'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: b.webhook_set ? '#10B981' : '#EF4444' }}>
                  <span className={`pulse-dot ${b.webhook_set ? 'green' : 'red'}`} />
                  {b.webhook_set ? 'Webhook active' : 'Webhook not set'}
                </span>
              </div>

              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                flexWrap: 'wrap'
              }}>
                {[
                  { href: `/dashboard/bots/${b.id}/settings`, label: 'Settings', icon: Settings },
                  { href: `/dashboard/bots/${b.id}/commands`, label: 'Commands', icon: Terminal },
                  { href: `/dashboard/bots/${b.id}/users`, label: 'Users', icon: Users }
                ].map((action) => {
                  const Icon = action.icon
                  return (
                    <a
                      key={action.href}
                      href={action.href}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '7px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        const a = e.currentTarget
                        a.style.background = 'rgba(59,130,246,0.1)'
                        a.style.color = 'var(--text-primary)'
                        a.style.borderColor = 'rgba(59,130,246,0.3)'
                      }}
                      onMouseLeave={(e) => {
                        const a = e.currentTarget
                        a.style.background = 'rgba(255,255,255,0.04)'
                        a.style.color = 'var(--text-secondary)'
                        a.style.borderColor = 'rgba(255,255,255,0.08)'
                      }}
                    >
                      <Icon size={13} />
                      {action.label}
                      <ChevronRight size={12} />
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

