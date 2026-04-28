'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Users, Bot, DollarSign, TrendingUp, Settings,
  Megaphone, AlertCircle, CheckCircle, Clock,
  Activity, RefreshCw
} from 'lucide-react'

export default function AdminDashboard() {
  const supabase = createClient()
  const botEngineUrl = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([])
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

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
      notify('Failed to load: ' + err.message, false)
    }
    setLoading(false)
  }

  async function approveCampaign(id: string) {
    const res = await fetch(`${botEngineUrl}/api/admin/campaigns/${id}/approve`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      notify('Campaign approved ✓')
      load()
    } else {
      notify(data.error || 'Failed', false)
    }
  }

  async function rejectCampaign(id: string) {
    const res = await fetch(`${botEngineUrl}/api/admin/campaigns/${id}/reject`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      notify('Campaign rejected')
      load()
    } else {
      notify(data.error || 'Failed', false)
    }
  }

  useEffect(() => { load() }, [])

  const card = (icon: any, label: string, value: any, color: string, sub?: string) => (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0',
      borderRadius: '12px', padding: '20px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{loading ? '...' : value}</div>
          {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '11px 16px', borderRadius: '10px', fontSize: '13px',
          background: toast.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
          color: toast.ok ? '#166534' : '#dc2626',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}>{toast.msg}</div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              🛡️ Admin Dashboard
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
              1-TouchBot Platform Overview
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={load} style={{ padding: '8px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <Link href="/dashboard/admin/settings" style={{ padding: '8px 14px', background: '#2563eb', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
              <Settings size={14} /> Settings
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {card(<Bot size={20} color="#2563eb" />, 'Total Bots', stats.totalBots, '#2563eb')}
          {card(<Users size={20} color="#7c3aed" />, 'Platform Users', stats.totalUsers, '#7c3aed')}
          {card(<Activity size={20} color="#059669" />, 'Bot Users', stats.totalBotUsers, '#059669')}
          {card(<DollarSign size={20} color="#d97706" />, 'Total Revenue', `$${(stats.totalRevenue || 0).toFixed(2)}`, '#d97706', 'Completed deposits')}
          {card(<TrendingUp size={20} color="#dc2626" />, 'Total Withdrawn', `$${(stats.totalWithdrawn || 0).toFixed(2)}`, '#dc2626')}
          {card(<Clock size={20} color="#f59e0b" />, 'Pending Withdrawals', stats.pendingWithdrawals, '#f59e0b', 'Awaiting approval')}
          {card(<Megaphone size={20} color="#8b5cf6" />, 'Pending Campaigns', stats.pendingCampaigns, '#8b5cf6', 'Awaiting approval')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={16} color="#8b5cf6" /> Pending Ad Campaigns
              </h3>
              <Link href="/dashboard/admin/campaigns" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>View all →</Link>
            </div>
            {pendingCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No pending campaigns</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingCampaigns.map(c => (
                  <div key={c.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '13px', marginBottom: '4px' }}>{c.title}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                      {c.users?.email} · ${Number(c.budget_usd).toFixed(2)} · {c.activity_window} · {c.target_audience_count} users
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => approveCampaign(c.id)}
                        style={{ padding: '4px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '11px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={11} /> Approve
                      </button>
                      <button onClick={() => rejectCampaign(c.id)}
                        style={{ padding: '4px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '11px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={11} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={16} color="#f59e0b" /> Pending Withdrawals
              </h3>
            </div>
            {recentWithdrawals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>No pending withdrawals</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentWithdrawals.map(w => (
                  <div key={w.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '13px' }}>
                      {w.bot_users?.first_name || 'Unknown'}
                      {w.bot_users?.telegram_username && <span style={{ color: '#64748b', fontWeight: 400 }}> @{w.bot_users.telegram_username}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                      ${Number(w.amount_usd).toFixed(4)} · {w.withdraw_address?.slice(0, 20)}...
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{w.gateway} · {new Date(w.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#2563eb" /> Recent Signups
            </h3>
            <Link href="/dashboard/admin/users" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Email', 'Plan', 'Balance', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#1e293b' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                        background: u.plan === 'pro' ? '#ede9fe' : '#f1f5f9',
                        color: u.plan === 'pro' ? '#7c3aed' : '#64748b'
                      }}>{u.plan || 'free'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#1e293b' }}>${Number(u.advertiser_balance || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { href: '/dashboard/admin/settings', icon: <Settings size={18} color="#2563eb" />, label: 'Platform Settings', desc: 'OxaPay keys, CPM rates' },
            { href: '/dashboard/admin/campaigns', icon: <Megaphone size={18} color="#8b5cf6" />, label: 'Ad Campaigns', desc: 'Approve & manage ads' },
            { href: '/dashboard/admin/users', icon: <Users size={18} color="#059669" />, label: 'All Users', desc: 'Manage platform users' },
            { href: '/dashboard/admin/bots', icon: <Bot size={18} color="#d97706" />, label: 'All Bots', desc: 'View all registered bots' },
            { href: '/dashboard/admin/transactions', icon: <DollarSign size={18} color="#dc2626" />, label: 'Transactions', desc: 'All platform transactions' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
              padding: '16px', textDecoration: 'none',
              transition: 'all 0.2s',
              display: 'block'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.background = '#eff6ff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.background = 'white' }}
            >
              <div style={{ marginBottom: '8px' }}>{item.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>{item.label}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
