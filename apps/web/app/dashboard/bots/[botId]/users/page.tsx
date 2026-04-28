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

const REJECT_REASONS = [
  'Insufficient verification',
  'Suspicious activity detected',
  'Address format invalid',
  'Duplicate withdrawal request',
  'Account under review',
  'Minimum threshold not met',
  'Custom reason...'
]

const BUTTON_TYPES = [
  { value: 'url', label: '🔗 Open URL / Website' },
  { value: 'join_channel', label: '📢 Join Channel' },
  { value: 'learn_more', label: '📖 Learn More' },
  { value: 'get_started', label: '🚀 Get Started' },
  { value: 'shop_now', label: '🛒 Shop Now' },
  { value: 'download', label: '⬇️ Download' },
  { value: 'contact_us', label: '📞 Contact Us' },
  { value: 'watch_video', label: '▶️ Watch Video' },
  { value: 'claim_offer', label: '🎁 Claim Offer' },
  { value: 'subscribe', label: '🔔 Subscribe' },
  { value: 'view_more', label: '👀 View More' },
]

export default function UsersPage() {
  const params = useParams()
  const botId = params.botId as string
  const supabase = createClient()

  // Users state
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'users' | 'withdrawals' | 'broadcast'>('users')

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([])
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [showPassphraseModal, setShowPassphraseModal] = useState(false)
  const [pendingApprovalIds, setPendingApprovalIds] = useState<string[]>([])
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [customRejectReason, setCustomRejectReason] = useState('')
  const [botSettings, setBotSettings] = useState<any>(null)

  // Broadcast state
  const [broadcastImage, setBroadcastImage] = useState('')
  const [broadcastImagePreview, setBroadcastImagePreview] = useState('')
  const [broadcastImageFile, setBroadcastImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastBtnType, setBroadcastBtnType] = useState('url')
  const [broadcastBtnLink, setBroadcastBtnLink] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastProgress, setBroadcastProgress] = useState(0)

  // Notification badge state
  const [newUsersCount, setNewUsersCount] = useState(0)
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0)

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
    if (ur.data) {
      setUsers(ur.data)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const newCount = ur.data.filter((u: any) => u.joined_at > oneDayAgo).length
      setNewUsersCount(newCount)
    }
    if (sr.data) setSettings(sr.data)

    // Load bot settings for withdrawal passphrase
    const { data: bs } = await supabase
      .from('bot_settings')
      .select('manual_withdrawal, withdrawal_passphrase, faucetpay_withdrawal_key, faucetpay_api_key')
      .eq('bot_id', botId).single()
    setBotSettings(bs)

    const { count: pendingCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .eq('type', 'withdrawal')
      .eq('status', 'pending')
    setPendingWithdrawalsCount(pendingCount || 0)

    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  async function loadWithdrawals() {
    setLoadingWithdrawals(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, bot_users(first_name, telegram_username, telegram_user_id)')
      .eq('bot_id', botId)
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false })
    setWithdrawals(data || [])
    const pendingCount = (data || []).filter((w: any) => w.status === 'pending').length
    setPendingWithdrawalsCount(pendingCount)
    setLoadingWithdrawals(false)
  }

  async function approveWithdrawals(ids: string[]) {
    if (passphrase !== botSettings?.withdrawal_passphrase) {
      notify('Incorrect passphrase', false)
      return
    }
    setShowPassphraseModal(false)
    for (const id of ids) {
      setProcessingWithdrawal(id)
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', id)
      if (!error) {
        const w = withdrawals.find(w => w.id === id)
        if (w) {
          try {
            const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
            await fetch(`${BOT_ENGINE_URL}/api/bots/${botId}/notify-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                telegramUserId: w.bot_users?.telegram_user_id,
                message: `✅ <b>Withdrawal Approved!</b>\n\nYour withdrawal of ${Number(w.amount_currency).toLocaleString()} has been processed.\n\nAddress: <code>${w.withdraw_address}</code>\n\n⏳ Funds should arrive within 24 hours.`
              })
            })
          } catch {}
        }
        notify('Payment approved ✓')
      } else {
        notify('Failed to approve: ' + error.message, false)
      }
    }
    setProcessingWithdrawal(null)
    setSelectedWithdrawals([])
    setPassphrase('')
    await loadWithdrawals()
  }

  async function rejectWithdrawal(id: string, reason: string) {
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'failed', gateway_tx_id: 'rejected: ' + reason })
      .eq('id', id)
    if (!error) {
      const w = withdrawals.find(w => w.id === id)
      if (w) {
        try {
          const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
          await fetch(`${BOT_ENGINE_URL}/api/bots/${botId}/notify-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramUserId: w.bot_users?.telegram_user_id,
              message: `❌ <b>Withdrawal Rejected</b>\n\nYour withdrawal request has been declined.\n\nReason: ${reason}\n\nYour balance has been restored. Contact support if you have questions.`
            })
          })
        } catch {}
        if (w?.bot_user_id) {
          const { data: botUser } = await supabase
            .from('bot_users')
            .select('id, balance')
            .eq('id', w.bot_user_id)
            .single()
          if (botUser) {
            await supabase
              .from('bot_users')
              .update({ balance: Number(botUser.balance) + Number(w.amount_currency || 0) })
              .eq('id', botUser.id)
          }
        }
      }
      notify('Withdrawal rejected')
      setRejectingId(null)
      setRejectReason('')
      setCustomRejectReason('')
      await loadWithdrawals()
    } else notify(error.message, false)
  }

  async function sendBroadcast() {
    if (!broadcastText.trim()) { notify('Message text is required', false); return }
    if (!confirm(`Send broadcast to all ${users.length} users?`)) return
    setBroadcasting(true)
    setBroadcastProgress(0)
    const selectedBtnType = BUTTON_TYPES.find(t => t.value === broadcastBtnType)
    const btnText = selectedBtnType ? selectedBtnType.label : broadcastBtnType
    const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/bots/${botId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: broadcastText,
          imageUrl: broadcastImage || null,
          buttonText: broadcastBtnLink ? btnText : null,
          buttonUrl: broadcastBtnLink || null,
        })
      })
      const data = await res.json()
      if (data.success) notify(`Broadcast sent to ${data.sent} users ✓`)
      else notify(data.error || 'Broadcast failed', false)
    } catch (e: any) {
      notify(e.message, false)
    }
    setBroadcasting(false)
  }

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px' }}>
        {[
          { key: 'users', label: '👥 Users', badge: newUsersCount },
          { key: 'withdrawals', label: '💸 Withdrawals', badge: pendingWithdrawalsCount },
          { key: 'broadcast', label: '📣 Broadcast', badge: 0 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any)
              if (tab.key === 'withdrawals') {
                loadWithdrawals()
                setPendingWithdrawalsCount(0)
              }
              if (tab.key === 'users') {
                setNewUsersCount(0)
              }
            }}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
              background: activeTab === tab.key ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: activeTab === tab.key ? '#60A5FA' : 'var(--text-secondary)',
              fontSize: '13px', fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: '#EF4444', color: 'white',
                borderRadius: '999px', padding: '1px 6px',
                fontSize: '10px', fontWeight: 700, minWidth: '16px',
                textAlign: 'center', lineHeight: '16px'
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username..."
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', color: '#1e293b' }}>
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
                      {['#', 'Name', 'Username', 'Total Balance', 'Joined', 'Last Active', 'Status', 'Actions'].map(h => (
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
                    <span><b style={{ color: '#1e293b', fontSize: '11px' }}>Total Balance: </b><b style={{ color: '#1e293b' }}>{Number(u.balance || 0).toLocaleString()}</b> {sym}</span>
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
        </>
      )}

      {/* Withdrawals tab */}
      {activeTab === 'withdrawals' && (
        <div>
          {loadingWithdrawals ? (
            <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Loading...</div>
          ) : (
            <>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                ⏳ Pending Withdrawals
              </h3>

              {selectedWithdrawals.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#60A5FA' }}>{selectedWithdrawals.length} selected</span>
                  <button
                    onClick={() => { setPendingApprovalIds(selectedWithdrawals); setShowPassphraseModal(true) }}
                    style={{ padding: '7px 14px', background: '#10B981', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    ✅ Pay Selected
                  </button>
                  <button onClick={() => setSelectedWithdrawals([])} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              )}

              {withdrawals.filter(w => w.status === 'pending').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                  No pending withdrawals
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {withdrawals.filter(w => w.status === 'pending').map(w => (
                    <div key={w.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedWithdrawals.includes(w.id)}
                        onChange={e => setSelectedWithdrawals(prev => e.target.checked ? [...prev, w.id] : prev.filter(id => id !== w.id))}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {w.bot_users?.first_name || 'Unknown'}
                          {w.bot_users?.telegram_username && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px', marginLeft: '8px' }}>@{w.bot_users.telegram_username}</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {Number(w.amount_currency).toLocaleString()} {sym} · ≈${Number(w.amount_usd).toFixed(4)} USD
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {w.withdraw_address}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmt(w.created_at)}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { setPendingApprovalIds([w.id]); setShowPassphraseModal(true) }}
                          style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '7px', color: '#10B981', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(w.id)}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#FCA5A5', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                        >
                          ❌ Reject
                        </button>
                      </div>

                      {rejectingId === w.id && (
                        <div style={{ position: 'absolute', right: '16px', top: '100%', marginTop: '8px', zIndex: 100, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', width: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Select reject reason</div>
                          <select
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            className="input-field"
                            style={{ marginBottom: '8px', color: '#1e293b', background: 'white' }}
                          >
                            <option value="">Choose reason...</option>
                            {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {rejectReason === 'Custom reason...' && (
                            <input
                              value={customRejectReason}
                              onChange={e => setCustomRejectReason(e.target.value)}
                              placeholder="Enter custom reason"
                              className="input-field"
                              style={{ marginBottom: '8px' }}
                            />
                          )}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => rejectWithdrawal(w.id, rejectReason === 'Custom reason...' ? customRejectReason : rejectReason)}
                              disabled={!rejectReason || (rejectReason === 'Custom reason...' && !customRejectReason)}
                              style={{ flex: 1, padding: '8px', background: '#EF4444', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                            >
                              Confirm Reject
                            </button>
                            <button onClick={() => setRejectingId(null)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                ✅ Completed Transactions
              </h3>
              {withdrawals.filter(w => w.status === 'completed' || w.status === 'failed').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No completed transactions yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {withdrawals.filter(w => w.status === 'completed' || w.status === 'failed').map(w => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {w.bot_users?.first_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {w.withdraw_address}
                        </div>
                        {w.status === 'failed' && w.gateway_tx_id?.startsWith('rejected:') && (
                          <div style={{ fontSize: '11px', color: '#FCA5A5', marginTop: '2px' }}>
                            Reason: {w.gateway_tx_id.replace('rejected: ', '')}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {Number(w.amount_currency).toLocaleString()} {sym}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmt(w.created_at)}</div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                        background: w.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: w.status === 'completed' ? '#10B981' : '#FCA5A5'
                      }}>
                        {w.status === 'completed' ? '✅ Paid' : '❌ Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Broadcast tab */}
      {activeTab === 'broadcast' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div style={{ padding: '16px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '10px', fontSize: '13px', color: '#60A5FA' }}>
                📣 This message will be sent to all <b>{users.filter(u => !u.is_banned).length}</b> active users of this bot.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Image (optional)</label>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <input
                    value={broadcastImage}
                    onChange={e => { setBroadcastImage(e.target.value); setBroadcastImagePreview(e.target.value) }}
                    className="input-field"
                    placeholder="Paste image URL..."
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or</span>
                    <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '10px', borderRadius: '8px', cursor: 'pointer',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'var(--text-secondary)', fontSize: '13px'
                  }}>
                    📁 Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5000000) { notify('Image too large. Max 5MB.', false); return }
                        setUploadingImage(true)
                        try {
                          const fileExt = file.name.split('.').pop()
                          const fileName = `broadcast-${Date.now()}.${fileExt}`
                          const { data, error } = await supabase.storage
                            .from('broadcast-images')
                            .upload(fileName, file, { upsert: true })
                          if (error) throw error
                          const { data: urlData } = supabase.storage
                            .from('broadcast-images')
                            .getPublicUrl(fileName)
                          const publicUrl = urlData.publicUrl
                          setBroadcastImage(publicUrl)
                          setBroadcastImagePreview(publicUrl)
                          notify('Image uploaded ✓')
                        } catch (err: any) {
                          notify('Upload failed: ' + err.message + '. Use an image URL instead.', false)
                        }
                        setUploadingImage(false)
                      }}
                    />
                  </label>
                  {broadcastImagePreview && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={broadcastImagePreview}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
                        onError={() => setBroadcastImagePreview('')}
                      />
                      <button
                        onClick={() => { setBroadcastImage(''); setBroadcastImagePreview('') }}
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Message Text <span style={{ color: '#EF4444' }}>*</span></label>
                <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} className="input-field" style={{ minHeight: '120px' }} placeholder="Enter your broadcast message..." />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Button Type</label>
                <select value={broadcastBtnType} onChange={e => setBroadcastBtnType(e.target.value)} className="input-field" style={{ color: '#1e293b', background: 'white' }}>
                  {BUTTON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Button Link</label>
                <input value={broadcastBtnLink} onChange={e => setBroadcastBtnLink(e.target.value)} className="input-field" placeholder="https://t.me/yourchannel" />
              </div>

              <button
                onClick={sendBroadcast}
                disabled={broadcasting || !broadcastText.trim()}
                style={{ padding: '12px', background: 'var(--blue-gradient)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {broadcasting ? 'Sending...' : `📣 Send Broadcast to ${users.filter(u => !u.is_banned).length} Users`}
              </button>
            </div>
        </div>
      )}

      {/* Passphrase modal */}
      {showPassphraseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              🔐 Confirm Payment
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Enter your withdrawal passphrase to approve {pendingApprovalIds.length} payment(s)
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              className="input-field"
              style={{ marginBottom: '16px' }}
              onKeyDown={e => e.key === 'Enter' && approveWithdrawals(pendingApprovalIds)}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => approveWithdrawals(pendingApprovalIds)}
                style={{ flex: 1, padding: '10px', background: '#10B981', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm & Pay
              </button>
              <button
                onClick={() => { setShowPassphraseModal(false); setPassphrase('') }}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User detail modal */}
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
                  ['Total Balance', Number(selected.balance || 0).toLocaleString() + ' ' + sym],
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
