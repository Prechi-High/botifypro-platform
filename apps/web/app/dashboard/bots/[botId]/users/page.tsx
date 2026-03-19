'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Search, Download, Eye, Ban, Trash2,
  RefreshCw, CheckCircle, AlertCircle, Loader2, X
} from 'lucide-react'

function fmt(v: any): string {
  if (!v) return 'Unknown'
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return 'Unknown'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return 'Unknown' }
}

function ago(v: any): string {
  if (!v) return 'Unknown'
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return 'Unknown'
    const s = Math.floor((Date.now() - d.getTime()) / 1000)
    if (s < 60) return 'Just now'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    if (s < 604800) return Math.floor(s / 86400) + 'd ago'
    return fmt(v)
  } catch { return 'Unknown' }
}

function recent(v: any): boolean {
  if (!v) return false
  try {
    const d = new Date(v)
    return !isNaN(d.getTime()) && (Date.now() - d.getTime()) < 7 * 86400 * 1000
  } catch { return false }
}

export default function UsersPage() {
  const params = useParams()
  const botId = params.botId as string
  const supabase = createClient()

  const [users, setUsers] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    const c = () => setMobile(window.innerWidth <= 768)
    c()
    window.addEventListener('resize', c)
    return () => window.removeEventListener('resize', c)
  }, [])

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [ur, sr] = await Promise.all([
      supabase.from('bot_users').select('*').eq('bot_id', botId).order('joined_at', { ascending: false }),
      supabase.from('bot_settings').select('currency_symbol,currency_name,usd_to_currency_rate').eq('bot_id', botId).single()
    ])
    if (ur.data) setUsers(ur.data)
    if (sr.data) setSettings(sr.data)
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  async function openDetail(u: any) {
    setSelected(u)
    const { data } = await supabase
      .from('transactions').select('*')
      .eq('bot_user_id', u.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setTxns(data || [])
  }

  async function banUser(id: string, ban: boolean, name: string) {
    if (!confirm(`${ban ? 'Ban' : 'Unban'} ${name}?`)) return
    const { error } = await supabase.from('bot_users').update({ is_banned: ban }).eq('id', id)
    if (!error) {
      notify(`${name} ${ban ? 'banned' : 'unbanned'} ✓`)
      await load()
      if (selected?.id === id) setSelected({ ...selected, is_banned: ban })
    } else notify(error.message, false)
  }

  async function resetBalance(id: string) {
    if (!confirm('Reset balance to 0? Cannot be undone.')) return
    const { error } = await supabase.from('bot_users').update({ balance: 0 }).eq('id', id)
    if (!error) {
      await supabase.from('transactions').insert({
        id: crypto.randomUUID(), bot_id: botId, bot_user_id: id,
        type: 'admin_reset', amount_currency: 0, amount_usd: 0, status: 'completed'
      })
      notify('Balance reset ✓')
      await load()
      if (selected?.id === id) setSelected({ ...selected, balance: 0 })
    } else notify(error.message, false)
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}?\n\nRemoves:\n- Their account\n- All transactions\n- Ad history\n\nCANNOT be undone.`)) return
    setDeleting(id)
    try {
      await supabase.from('transactions').delete().eq('bot_user_id', id)
      await supabase.from('ad_impressions').delete().eq('bot_user_id', id)
      const { error } = await supabase.from('bot_users').delete().eq('id', id)
      if (error) throw error
      notify(name + ' deleted permanently')
      setSelected(null)
      await load()
    } catch (e: any) { notify(e.message, false) }
    setDeleting(null)
  }

  function exportCSV() {
    const rows = [
      'ID,Telegram ID,Name,Username,Balance,Joined,Last Active,Banned,Channel Verified',
      ...filtered.map(u => [
        u.id, u.telegram_user_id,
        (u.first_name || '').replace(/,/g, ' '),
        u.telegram_username ? '@' + u.telegram_username : '',
        u.balance || 0, fmt(u.joined_at), fmt(u.last_active),
        u.is_banned ? 'Yes' : 'No',
        u.channel_verified ? 'Yes' : 'No'
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }))
    a.download = `bot-users-${botId}-${new Date().toISOString().split('T')[0]}.csv` 
    a.click()
  }

  const filtered = users.filter(u => {
    const s = search.toLowerCase()
    const ms = !s || (u.first_name || '').toLowerCase().includes(s) || (u.telegram_username || '').toLowerCase().includes(s)
    const mf =
      filter === 'all' ||
      (filter === 'banned' && u.is_banned) ||
      (filter === 'active' && !u.is_banned && recent(u.last_active)) ||
      (filter === 'inactive' && !u.is_banned && !recent(u.last_active))
    return ms && mf
  })

  const sym = settings?.currency_symbol || '🪙'

  function StatusBadge({ u }: { u: any }) {
    if (u.is_banned) return <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>Banned</span>
    if (recent(u.last_active)) return <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>Active</span>
    return <span style={{ background: '#f8fafc', color: '#94a3b8', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', border: '1px solid #e2e8f0' }}>Inactive</span>
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '11px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: toast.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
          color: toast.ok ? '#166534' : '#dc2626',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color='#3b82f6' />
            Bot Users
            <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
              {users.length}
            </span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Manage all users who have messaged your bot</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#374151', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={15} />Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', color: '#374151' }}>
          <option value="all">All ({users.length})</option>
          <option value="active">Active ({users.filter(u => !u.is_banned && recent(u.last_active)).length})</option>
          <option value="inactive">Inactive ({users.filter(u => !u.is_banned && !recent(u.last_active)).length})</option>
          <option value="banned">Banned ({users.filter(u => u.is_banned).length})</option>
        </select>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', padding: '20px' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />Loading users...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
          <Users size={36} color='#cbd5e1' style={{ marginBottom: '12px' }} />
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            {users.length === 0 ? 'No users have messaged this bot yet.' : 'No users match your search.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && !mobile && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['#', 'Name', 'Username', 'Balance', 'Joined', 'Last Active', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{u.first_name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {String(u.telegram_user_id)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: u.telegram_username ? '#2563eb' : '#cbd5e1' }}>
                      {u.telegram_username ? '@' + u.telegram_username : 'No username'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500', fontFamily: 'monospace', color: '#1e293b' }}>
                      {Number(u.balance || 0).toLocaleString()} {sym}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(u.joined_at)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{ago(u.last_active)}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge u={u} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openDetail(u)} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#374151', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Eye size={12} />View
                        </button>
                        <button onClick={() => banUser(u.id, !u.is_banned, u.first_name || 'User')} style={{ padding: '4px 8px', border: `1px solid ${u.is_banned ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px', background: u.is_banned ? '#f0fdf4' : '#fef2f2', color: u.is_banned ? '#166534' : '#dc2626', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Ban size={12} />{u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                        <button onClick={() => deleteUser(u.id, u.first_name || 'User')} disabled={deleting === u.id} style={{ padding: '4px 8px', border: '1px solid #fecaca', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', opacity: deleting === u.id ? 0.5 : 1 }}>
                          {deleting === u.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                          {deleting === u.id ? '...' : 'Del'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && mobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{u.first_name || 'Unknown'}</div>
                  <div style={{ fontSize: '12px', color: u.telegram_username ? '#2563eb' : '#cbd5e1', marginTop: '1px' }}>
                    {u.telegram_username ? '@' + u.telegram_username : 'No username'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>ID: {String(u.telegram_user_id)}</div>
                </div>
                <StatusBadge u={u} />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                <span><b style={{ color: '#1e293b' }}>{Number(u.balance || 0).toLocaleString()}</b> {sym}</span>
                <span>Joined {fmt(u.joined_at)}</span>
                <span>{ago(u.last_active)}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openDetail(u)} style={{ flex: 1, padding: '7px', border: '1px solid #e2e8f0', borderRadius: '7px', background: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Eye size={13} />View
                </button>
                <button onClick={() => banUser(u.id, !u.is_banned, u.first_name || 'User')} style={{ flex: 1, padding: '7px', border: `1px solid ${u.is_banned ? '#bbf7d0' : '#fecaca'}`, borderRadius: '7px', background: u.is_banned ? '#f0fdf4' : '#fef2f2', color: u.is_banned ? '#166534' : '#dc2626', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Ban size={13} />{u.is_banned ? 'Unban' : 'Ban'}
                </button>
                <button onClick={() => deleteUser(u.id, u.first_name || 'User')} disabled={deleting === u.id} style={{ flex: 1, padding: '7px', border: '1px solid #fecaca', borderRadius: '7px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Trash2 size={13} />{deleting === u.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '88vh', overflow: 'auto' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 2px' }}>{selected.first_name || 'Unknown'}</h2>
                <p style={{ fontSize: '12px', color: selected.telegram_username ? '#2563eb' : '#94a3b8', margin: 0 }}>
                  {selected.telegram_username ? '@' + selected.telegram_username : 'No username'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  ['Telegram ID', String(selected.telegram_user_id || 'N/A')],
                  ['Balance', Number(selected.balance || 0).toLocaleString() + ' ' + sym],
                  ['Channel Verified', selected.channel_verified ? '✅ Yes' : '❌ No'],
                  ['Status', selected.is_banned ? '🚫 Banned' : '✅ Active'],
                  ['Joined', fmt(selected.joined_at)],
                  ['Last Active', ago(selected.last_active)],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{v}</div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>Recent Transactions</h3>
              {txns.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px' }}>No transactions yet</p>
                : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                    {txns.map((tx, i) => (
                      <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', fontSize: '12px', background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: i < txns.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <div>
                          <span style={{ fontWeight: '500', color: '#374151', textTransform: 'capitalize' }}>{(tx.type || '').replace(/_/g, ' ')}</span>
                          <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{fmt(tx.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '500', color: '#1e293b' }}>{Number(tx.amount_currency || 0).toLocaleString()} {sym}</span>
                          <span style={{ padding: '1px 6px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: tx.status === 'completed' ? '#f0fdf4' : tx.status === 'pending' ? '#fffbeb' : '#fef2f2', color: tx.status === 'completed' ? '#166534' : tx.status === 'pending' ? '#92400e' : '#dc2626' }}>{tx.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button onClick={() => banUser(selected.id, !selected.is_banned, selected.first_name || 'User')}
                  style={{ padding: '9px', border: `1px solid ${selected.is_banned ? '#bbf7d0' : '#fecaca'}`, borderRadius: '8px', background: selected.is_banned ? '#f0fdf4' : '#fef2f2', color: selected.is_banned ? '#166534' : '#dc2626', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Ban size={14} />{selected.is_banned ? 'Unban' : 'Ban'}
                </button>
                <button onClick={() => resetBalance(selected.id)}
                  style={{ padding: '9px', border: '1px solid #fde68a', borderRadius: '8px', background: '#fffbeb', color: '#92400e', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <RefreshCw size={14} />Reset
                </button>
                <button onClick={() => deleteUser(selected.id, selected.first_name || 'User')} disabled={deleting === selected.id}
                  style={{ padding: '9px', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Trash2 size={14} />{deleting === selected.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}