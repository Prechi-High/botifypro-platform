'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Search, RefreshCw } from 'lucide-react'

type Tab = 'all' | 'today' | 'pro' | 'advertisers'

export default function AdminUsersPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('all')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    try {
      let query = supabase.from('users').select('id, email, full_name, plan, role, advertiser_balance, created_at').order('created_at', { ascending: false })

      if (tab === 'today') {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        query = query.gte('created_at', todayStart.toISOString())
      } else if (tab === 'pro') {
        query = query.eq('plan', 'pro')
      } else if (tab === 'advertisers') {
        query = query.not('advertiser_balance', 'is', null)
      }

      const { data } = await query.limit(200)
      setUsers(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function upgradePlan(id: string, plan: 'free' | 'pro') {
    const { error } = await supabase.from('users').update({ plan }).eq('id', id)
    if (error) { notify('Failed to update plan', false); return }
    notify(`Plan updated to ${plan}`)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, plan } : u))
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) { notify('Failed to delete user', false); return }
    notify('User deleted')
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (u.email || '').toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s)
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All Users' },
    { key: 'today', label: 'Joined Today' },
    { key: 'pro', label: 'Pro Members' },
    { key: 'advertisers', label: 'Advertisers' },
  ]

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
            <Users size={20} /> Users
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{filtered.length} shown</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${tab === t.key ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.08)'}`, background: tab === t.key ? 'rgba(57,255,20,0.1)' : 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name..." className="input-field" style={{ paddingLeft: '36px' }} />
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>No users found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Name', 'Plan', 'Role', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: u.plan === 'pro' ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${u.plan === 'pro' ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.12)'}`, color: u.plan === 'pro' ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {u.plan?.toUpperCase() || 'FREE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{u.role || 'creator'}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.plan !== 'pro' ? (
                          <button onClick={() => upgradePlan(u.id, 'pro')} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(57,255,20,0.3)', background: 'rgba(57,255,20,0.08)', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}>→ Pro</button>
                        ) : (
                          <button onClick={() => upgradePlan(u.id, 'free')} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>→ Free</button>
                        )}
                        <button onClick={() => deleteUser(u.id, u.email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#FCA5A5', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                      </div>
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
