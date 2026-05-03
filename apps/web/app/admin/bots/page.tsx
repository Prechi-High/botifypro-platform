'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Search, RefreshCw, Pause, Play, AlertTriangle } from 'lucide-react'

type Tab = 'all' | 'webhook'

export default function AdminBotsPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [tab, setTab] = useState<Tab>('all')
  const [bots, setBots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [fixingAll, setFixingAll] = useState(false)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      // Fetch bots with creator info and user count
      const { data: botsData } = await supabase
        .from('bots')
        .select('id, bot_name, bot_username, is_active, is_paused, webhook_set, category, created_at, users(email, plan)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (!botsData) { setBots([]); setLoading(false); return }

      // Get user counts per bot
      const botIds = botsData.map((b: any) => b.id)
      const counts: Record<string, number> = {}
      if (botIds.length > 0) {
        for (const bot of botsData) {
          const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true }).eq('bot_id', bot.id)
          counts[bot.id] = count || 0
        }
      }

      setBots(botsData.map((b: any) => ({ ...b, userCount: counts[b.id] || 0 })))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function togglePause(bot: any) {
    const { error } = await supabase.from('bots').update({ is_paused: !bot.is_paused }).eq('id', bot.id)
    if (error) { notify('Failed', false); return }
    notify(bot.is_paused ? 'Bot resumed' : 'Bot paused')
    setBots(prev => prev.map(b => b.id === bot.id ? { ...b, is_paused: !b.is_paused } : b))
  }

  async function fixAllWebhooks() {
    setFixingAll(true)
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/refresh-webhooks`, { method: 'POST' })
      const data = await res.json()
      notify(data.message || 'Webhooks refreshed')
      load()
    } catch { notify('Failed to refresh webhooks', false) }
    setFixingAll(false)
  }

  const filtered = bots.filter(b => {
    const matchTab = tab === 'webhook' ? !b.webhook_set : true
    if (!matchTab) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (b.bot_name || '').toLowerCase().includes(s) || (b.bot_username || '').toLowerCase().includes(s) || (b.users?.email || '').toLowerCase().includes(s)
  })

  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '11px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, background: toast.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`, color: toast.ok ? '#166534' : '#dc2626', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} /> Bots
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{filtered.length} shown</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'webhook' && (
            <button onClick={fixAllWebhooks} disabled={fixingAll} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              {fixingAll ? 'Fixing...' : '⚡ Fix All Webhooks'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[{ key: 'all' as Tab, label: 'All Bots' }, { key: 'webhook' as Tab, label: '⚠️ Webhook Issues' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${tab === t.key ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.08)'}`, background: tab === t.key ? 'rgba(57,255,20,0.1)' : 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, username or creator email..." className="input-field" style={{ paddingLeft: '36px' }} />
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>No bots found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Bot', 'Creator', 'Users', 'Category', 'Webhook', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{b.bot_name || 'Unnamed'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{b.bot_username || '—'}</div>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.users?.email || '—'}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{b.userCount.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{b.category || 'general'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '11px', color: b.webhook_set ? '#34D399' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {b.webhook_set ? '✓ Active' : <><AlertTriangle size={11} /> Not set</>}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: b.is_paused ? 'rgba(245,158,11,0.1)' : b.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${b.is_paused ? 'rgba(245,158,11,0.3)' : b.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: b.is_paused ? '#FBBF24' : b.is_active ? '#34D399' : '#FCA5A5' }}>
                        {b.is_paused ? 'PAUSED' : b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => togglePause(b)} style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${b.is_paused ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, background: b.is_paused ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', color: b.is_paused ? '#34D399' : '#FBBF24', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {b.is_paused ? <><Play size={11} />Resume</> : <><Pause size={11} />Pause</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
