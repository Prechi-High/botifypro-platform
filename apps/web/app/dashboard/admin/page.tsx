'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Users, Bot, DollarSign, TrendingUp, Settings,
  Megaphone, AlertCircle, CheckCircle, Clock,
  Activity, RefreshCw
} from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminDashboard() {
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()
  const botEngineUrl = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([])
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])

  async function load() {
    setLoading(true)
    try {
      const [
        { count: totalBots },
        { count: totalUsers },
        { count: totalBotUsers },
        { data: withdrawals },
        { data: campaigns },
        { data: users },
        { data: transactions }
      ] = await Promise.all([
        supabase.from('bots').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }),
        supabase.from('transactions')
          .select('*, bot_users(first_name, telegram_username)')
          .eq('type', 'withdrawal').eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('ad_campaigns')
          .select('*, users(email)')
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('users')
          .select('id, email, plan, created_at, advertiser_balance')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('transactions')
          .select('amount_usd, type, status, created_at')
          .eq('status', 'completed')
      ])

      const totalRevenue = (transactions || [])
        .filter((t: any) => t.type === 'deposit')
        .reduce((sum: number, t: any) => sum + Number(t.amount_usd || 0), 0)

      const totalWithdrawn = (transactions || [])
        .filter((t: any) => t.type === 'withdrawal')
        .reduce((sum: number, t: any) => sum + Number(t.amount_usd || 0), 0)

      setStats({
        totalBots: totalBots || 0,
        totalUsers: totalUsers || 0,
        totalBotUsers: totalBotUsers || 0,
        totalRevenue,
        totalWithdrawn,
        pendingWithdrawals: withdrawals?.length || 0,
        pendingCampaigns: campaigns?.length || 0
      })
      setRecentWithdrawals(withdrawals || [])
      setPendingCampaigns(campaigns || [])
      setRecentUsers(users || [])
    } catch (err: any) {
      toast.error('Failed to load: ' + err.message)
    }
    setLoading(false)
  }

  async function approveCampaign(id: string) {
    const res = await fetch(`${botEngineUrl}/api/admin/campaigns/${id}/approve`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      toast.success('Campaign approved ✓')
      load()
    } else {
      toast.error(data.error || 'Failed')
    }
  }

  async function rejectCampaign(id: string) {
    const res = await fetch(`${botEngineUrl}/api/admin/campaigns/${id}/reject`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      toast.success('Campaign rejected')
      load()
    } else {
      toast.error(data.error || 'Failed')
    }
  }

  useEffect(() => { load() }, [])

  const statCards = [
    { icon: Bot, label: 'Total Bots', value: stats.totalBots, iconColor: '#818CF8', iconBg: 'rgba(99,102,241,0.18)' },
    { icon: Users, label: 'Platform Users', value: stats.totalUsers, iconColor: '#A78BFA', iconBg: 'rgba(139,92,246,0.18)' },
    { icon: Activity, label: 'Bot Users', value: stats.totalBotUsers, iconColor: '#34D399', iconBg: 'rgba(16,185,129,0.18)' },
    { icon: DollarSign, label: 'Total Revenue', value: `$${(stats.totalRevenue || 0).toFixed(2)}`, iconColor: '#FBBF24', iconBg: 'rgba(245,158,11,0.18)', sub: 'Completed deposits' },
    { icon: TrendingUp, label: 'Total Withdrawn', value: `$${(stats.totalWithdrawn || 0).toFixed(2)}`, iconColor: '#F87171', iconBg: 'rgba(239,68,68,0.18)' },
    { icon: Clock, label: 'Pending Withdrawals', value: stats.pendingWithdrawals, iconColor: '#60A5FA', iconBg: 'rgba(59,130,246,0.18)', sub: 'Awaiting approval' },
    { icon: Megaphone, label: 'Pending Campaigns', value: stats.pendingCampaigns, iconColor: 'var(--accent)', iconBg: 'rgba(57,255,20,0.12)', sub: 'Awaiting approval' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} color="var(--accent)" /> Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0', fontFamily: 'Inter, sans-serif' }}>
            1-TouchBot Platform Overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} className="btn-ghost" style={{ padding: '8px 14px', fontSize: '13px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link href="/dashboard/admin/settings" className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px', borderRadius: 'var(--radius-md)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={14} /> Settings
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}>{card.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {loading ? '—' : card.value}
                  </div>
                  {card.sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>{card.sub}</div>}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={card.iconColor} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Campaigns + Withdrawals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Pending Campaigns */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
              <Megaphone size={15} color="var(--accent)" /> Pending Ad Campaigns
            </h3>
            <Link href="/dashboard/admin/campaigns" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>View all →</Link>
          </div>
          {pendingCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No pending campaigns</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingCampaigns.map(c => (
                <div key={c.id} style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif" }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                    {c.users?.email} · ${Number(c.budget_usd).toFixed(2)} · {c.activity_window} · {c.target_audience_count} users
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => approveCampaign(c.id)}
                      style={{ padding: '4px 12px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      <CheckCircle size={11} /> Approve
                    </button>
                    <button
                      onClick={() => rejectCampaign(c.id)}
                      style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: '#FCA5A5', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      <AlertCircle size={11} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Withdrawals */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
            <DollarSign size={15} color="#FBBF24" /> Pending Withdrawals
          </h3>
          {recentWithdrawals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No pending withdrawals</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentWithdrawals.map(w => (
                <div key={w.id} style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {w.bot_users?.first_name || 'Unknown'}
                    {w.bot_users?.telegram_username && (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontFamily: 'Inter, sans-serif' }}> @{w.bot_users.telegram_username}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                    ${Number(w.amount_usd).toFixed(4)} · {w.withdraw_address?.slice(0, 20)}...
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                    {w.gateway} · {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent signups */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
            <Users size={15} color="#60A5FA" /> Recent Signups
          </h3>
          <Link href="/dashboard/admin/users" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>View all →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '500px' }}>
            <thead>
              <tr>
                {['Email', 'Plan', 'Balance', 'Joined'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>{u.email}</td>
                  <td>
                    <span className={u.plan === 'pro' ? 'badge-active' : 'badge-inactive'}>
                      {u.plan || 'free'}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>${Number(u.advertiser_balance || 0).toFixed(2)}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 style={{ fontSize: '16px', margin: '0 0 12px', fontFamily: "'Space Grotesk', sans-serif" }}>Quick Links</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {[
            { href: '/dashboard/admin/settings', Icon: Settings, label: 'Platform Settings', desc: 'OxaPay keys, CPM rates', color: '#818CF8' },
            { href: '/dashboard/admin/campaigns', Icon: Megaphone, label: 'Ad Campaigns', desc: 'Approve & manage ads', color: 'var(--accent)' },
            { href: '/dashboard/admin/users', Icon: Users, label: 'All Users', desc: 'Manage platform users', color: '#34D399' },
            { href: '/dashboard/admin/bots', Icon: Bot, label: 'All Bots', desc: 'View all registered bots', color: '#FBBF24' },
            { href: '/dashboard/admin/transactions', Icon: DollarSign, label: 'Transactions', desc: 'All platform transactions', color: '#F87171' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ cursor: 'pointer', padding: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <item.Icon size={18} color={item.color} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px', fontFamily: "'Space Grotesk', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
