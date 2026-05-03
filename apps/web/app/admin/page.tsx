'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Bot, Megaphone, DollarSign, Clock, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react'

type Stats = {
  totalUsers: number
  joinedToday: number
  totalBots: number
  activeBots: number
  totalBotAudience: number
  totalAdverts: number
  activeAds: number
  pendingAds: number
  totalDepositsUsd: number
  platformFeesUsd: number
}

export default function AdminOverviewPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, joinedToday: 0, totalBots: 0, activeBots: 0, totalBotAudience: 0, totalAdverts: 0, activeAds: 0, pendingAds: 0, totalDepositsUsd: 0, platformFeesUsd: 0 })
  const [loading, setLoading] = useState(true)
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  async function load() {
    setLoading(true)
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

      const [
        { count: totalUsers },
        { count: joinedToday },
        { data: bots },
        { count: totalBotAudience },
        { count: totalAdverts },
        { count: activeAds },
        { count: pendingAds },
        { data: depositTxns },
        { data: feeTxns },
        { data: campaigns },
        { data: withdrawals },
        { data: users },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('bots').select('id, is_active, is_paused'),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }),
        supabase.from('ad_campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('ad_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('ad_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('transactions').select('amount_usd').eq('type', 'deposit').eq('status', 'completed'),
        supabase.from('transactions').select('platform_fee_amount').eq('status', 'completed'),
        supabase.from('ad_campaigns').select('id, title, budget_usd, created_at, users(email)').eq('status', 'pending_approval').order('created_at', { ascending: false }).limit(5),
        supabase.from('transactions').select('id, amount_usd, amount_currency, created_at, bot_users(first_name, telegram_username)').eq('type', 'withdrawal').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('users').select('id, email, plan, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      const botsArr = bots || []
      const totalBots = botsArr.length
      const activeBots = botsArr.filter((b: any) => b.is_active && !b.is_paused).length
      const totalDepositsUsd = (depositTxns || []).reduce((s: number, t: any) => s + Number(t.amount_usd || 0), 0)
      const platformFeesUsd = (feeTxns || []).reduce((s: number, t: any) => s + Number(t.platform_fee_amount || 0), 0)

      setStats({ totalUsers: totalUsers || 0, joinedToday: joinedToday || 0, totalBots, activeBots, totalBotAudience: totalBotAudience || 0, totalAdverts: totalAdverts || 0, activeAds: activeAds || 0, pendingAds: pendingAds || 0, totalDepositsUsd, platformFeesUsd })
      setPendingCampaigns(campaigns || [])
      setPendingWithdrawals(withdrawals || [])
      setRecentUsers(users || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function approveCampaign(id: string) {
    await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/approve`, { method: 'POST' })
    load()
  }
  async function rejectCampaign(id: string) {
    await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/reject`, { method: 'POST' })
    load()
  }

  const statCards = [
    { label: 'TOTAL USERS', value: stats.totalUsers, icon: Users, color: '#818CF8', bg: 'rgba(99,102,241,0.15)' },
    { label: 'JOINED TODAY', value: stats.joinedToday, icon: Users, color: '#34D399', bg: 'rgba(16,185,129,0.15)' },
    { label: 'TOTAL BOTS', value: stats.totalBots, icon: Bot, color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
    { label: 'ACTIVE BOTS', value: stats.activeBots, icon: Zap, color: '#A78BFA', bg: 'rgba(139,92,246,0.15)' },
    { label: 'BOT AUDIENCE', value: stats.totalBotAudience.toLocaleString(), icon: Users, color: '#FBBF24', bg: 'rgba(245,158,11,0.15)' },
    { label: 'TOTAL ADVERTS', value: stats.totalAdverts, icon: Megaphone, color: '#F472B6', bg: 'rgba(244,114,182,0.15)' },
    { label: 'ACTIVE ADS', value: stats.activeAds, icon: CheckCircle, color: '#34D399', bg: 'rgba(16,185,129,0.15)' },
    { label: 'PENDING ADS', value: stats.pendingAds, icon: Clock, color: '#FBBF24', bg: 'rgba(245,158,11,0.15)' },
    { label: 'TOTAL DEPOSITS', value: `$${stats.totalDepositsUsd.toFixed(2)}`, icon: DollarSign, color: '#34D399', bg: 'rgba(16,185,129,0.15)' },
    { label: 'PLATFORM FEES', value: `$${stats.platformFeesUsd.toFixed(2)}`, icon: DollarSign, color: '#818CF8', bg: 'rgba(99,102,241,0.15)' },
  ]

  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Overview</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>Platform-wide metrics</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat cards — 2 per row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {statCards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}>{c.label}</span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={c.color} />
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: '32px', width: '60%', borderRadius: '6px' }} />
              ) : (
                <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>{c.value}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending Campaigns */}
      {pendingCampaigns.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={15} color="#FBBF24" /> Pending Ad Campaigns ({pendingCampaigns.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingCampaigns.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.users?.email} · ${Number(c.budget_usd).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => approveCampaign(c.id)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#34D399', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Approve</button>
                  <button onClick={() => rejectCampaign(c.id)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
          <a href="/admin/advertising" style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', textAlign: 'right' }}>View all campaigns →</a>
        </div>
      )}

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={15} color="#FBBF24" /> Pending Withdrawals ({pendingWithdrawals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingWithdrawals.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{w.bot_users?.first_name || 'User'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>${Number(w.amount_usd).toFixed(4)} · {new Date(w.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize: '11px', color: '#FBBF24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '2px 8px' }}>PENDING</span>
              </div>
            ))}
          </div>
          <a href="/admin/transactions" style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', textAlign: 'right' }}>View all transactions →</a>
        </div>
      )}

      {/* Recent Signups */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Signups</h3>
        {loading ? (
          <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
        ) : recentUsers.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No users yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{u.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: u.plan === 'pro' ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${u.plan === 'pro' ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.12)'}`, color: u.plan === 'pro' ? 'var(--accent)' : 'var(--text-muted)' }}>{u.plan?.toUpperCase() || 'FREE'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <a href="/admin/users" style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', textAlign: 'right' }}>View all users →</a>
      </div>
    </div>
  )
}
