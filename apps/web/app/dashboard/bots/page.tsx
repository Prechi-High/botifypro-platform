'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Plus, AlertCircle, Settings, Terminal, Users, Zap, ChevronRight, Pause, Play, Trash2, X, AlertTriangle } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function BotsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bots, setBots] = useState<any[]>([])

  // Pause state
  const [togglingPause, setTogglingPause] = useState<string | null>(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

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
          .select('id, bot_name, bot_username, is_active, is_paused, webhook_set, category, platform_admin_confirmed, created_at')
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
    return () => { cancelled = true }
  }, [supabase])

  async function togglePause(bot: any) {
    setTogglingPause(bot.id)
    try {
      const newPaused = !bot.is_paused
      const { error } = await supabase
        .from('bots')
        .update({ is_paused: newPaused })
        .eq('id', bot.id)
      if (error) throw error
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, is_paused: newPaused } : b))
      toast.success(newPaused ? 'Bot paused — it will stop responding.' : 'Bot resumed.')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update bot')
    } finally {
      setTogglingPause(null)
    }
  }

  async function deleteBot() {
    if (!deleteTarget || deleteInput !== 'DELETE') return
    setDeleting(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Not authenticated')

      // Delete in correct cascade order
      const botId = deleteTarget.id

      // 1. Ad impressions for bot users
      const { data: botUsers } = await supabase.from('bot_users').select('id').eq('bot_id', botId)
      const botUserIds = (botUsers || []).map((u: any) => u.id)
      if (botUserIds.length > 0) {
        await supabase.from('ad_impressions').delete().in('bot_user_id', botUserIds)
      }

      // 2. Referrals
      await supabase.from('referrals').delete().eq('bot_id', botId)

      // 3. Transactions
      await supabase.from('transactions').delete().eq('bot_id', botId)

      // 4. Deposit transactions
      await supabase.from('deposit_transactions').delete().eq('bot_id', botId)

      // 5. Bot users
      await supabase.from('bot_users').delete().eq('bot_id', botId)

      // 6. Bot commands
      await supabase.from('bot_commands').delete().eq('bot_id', botId)

      // 7. Investment plans
      await supabase.from('investment_plans').delete().eq('bot_id', botId)

      // 8. Bot settings
      await supabase.from('bot_settings').delete().eq('bot_id', botId)

      // 9. Bot itself
      const { error } = await supabase.from('bots').delete().eq('id', botId).eq('creator_id', userId)
      if (error) throw error

      setBots(prev => prev.filter(b => b.id !== botId))
      setDeleteTarget(null)
      setDeleteInput('')
      toast.success('Bot and all associated data deleted.')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete bot')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setDeleteTarget(null); setDeleteInput('') } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ width: '100%', maxWidth: '420px', background: '#0D0D0D', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />
            <div style={{ padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={20} color="#ef4444" />
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Delete Bot</h2>
                </div>
                <button onClick={() => { setDeleteTarget(null); setDeleteInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#FCA5A5', lineHeight: 1.6 }}>
                <strong>⚠️ This action is permanent and cannot be undone.</strong><br /><br />
                Deleting <strong>{deleteTarget.bot_name || deleteTarget.bot_username || 'this bot'}</strong> will permanently remove:
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                  <li>All bot users and their balances</li>
                  <li>All transactions and referrals</li>
                  <li>All commands and settings</li>
                  <li>All investment plans</li>
                </ul>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Type <strong style={{ color: '#ef4444' }}>DELETE</strong> to confirm:
                </label>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="input-field"
                  style={{ borderColor: deleteInput === 'DELETE' ? 'rgba(239,68,68,0.5)' : undefined }}
                />
              </div>

              <button
                onClick={deleteBot}
                disabled={deleteInput !== 'DELETE' || deleting}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                  background: deleteInput === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.2)',
                  color: deleteInput === 'DELETE' ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: 'none', cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
              >
                {deleting ? 'Deleting...' : '🗑️ Permanently Delete Bot'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px', color: '#FCA5A5', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ marginTop: '1px' }} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', height: '120px' }} />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '36px', textAlign: 'center' }}>
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
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${b.is_paused ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '16px', padding: '20px', transition: 'all 0.2s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: b.is_paused ? 'linear-gradient(135deg, #92400e, #78350f)' : 'linear-gradient(135deg, #3B82F6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {b.is_paused && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '999px', padding: '2px 8px' }}>PAUSED</span>
                  )}
                  <span className={b.is_active && !b.is_paused ? 'badge-active' : 'badge-inactive'}>
                    {b.is_paused ? 'Paused' : b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {b.category || 'general'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: b.webhook_set ? '#10B981' : '#EF4444' }}>
                  <span className={`pulse-dot ${b.webhook_set ? 'green' : 'red'}`} />
                  {b.webhook_set ? 'Webhook active' : 'Webhook not set'}
                </span>
              </div>

              {/* Action buttons row */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
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
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                      onMouseEnter={e => { const a = e.currentTarget; a.style.background = 'rgba(59,130,246,0.1)'; a.style.color = 'var(--text-primary)'; a.style.borderColor = 'rgba(59,130,246,0.3)' }}
                      onMouseLeave={e => { const a = e.currentTarget; a.style.background = 'rgba(255,255,255,0.04)'; a.style.color = 'var(--text-secondary)'; a.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    >
                      <Icon size={13} />
                      {action.label}
                      <ChevronRight size={12} />
                    </a>
                  )
                })}

                {/* Pause / Resume */}
                <button
                  onClick={() => togglePause(b)}
                  disabled={togglingPause === b.id}
                  style={{ background: b.is_paused ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${b.is_paused ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 500, color: b.is_paused ? '#34D399' : '#FBBF24', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                >
                  {togglingPause === b.id ? '...' : b.is_paused ? <><Play size={13} />Resume</> : <><Pause size={13} />Pause</>}
                </button>

                {/* Delete */}
                <button
                  onClick={() => { setDeleteTarget(b); setDeleteInput('') }}
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 500, color: '#FCA5A5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
