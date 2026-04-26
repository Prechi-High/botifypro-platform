'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bot, Users, DollarSign, TrendingUp, ArrowUpRight, Zap, Megaphone } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

type Stats = {
  bots: number
  users: number
  deposits: number
  withdrawals: number
}

export default function DashboardHome() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({ bots: 0, users: 0, deposits: 0, withdrawals: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) throw new Error('Not authenticated')

        const botsRes = await supabase.from('bots').select('id', { count: 'exact', head: true }).eq('creator_id', userId)
        const botsCount = botsRes.count || 0

        const botsListRes = await supabase.from('bots').select('id').eq('creator_id', userId)
        const botIds = (botsListRes.data || []).map((b: any) => b.id)

        let usersCount = 0
        let depositsCount = 0
        let withdrawalsCount = 0

        if (botIds.length > 0) {
          const usersRes = await supabase.from('bot_users').select('id', { count: 'exact', head: true }).in('bot_id', botIds)
          usersCount = usersRes.count || 0

          const depRes = await supabase.from('transactions').select('id', { count: 'exact', head: true }).in('bot_id', botIds).eq('type', 'deposit')
          depositsCount = depRes.count || 0

          const wRes = await supabase.from('transactions').select('id', { count: 'exact', head: true }).in('bot_id', botIds).eq('type', 'withdrawal')
          withdrawalsCount = wRes.count || 0
        }

        if (cancelled) return
        setStats({ bots: botsCount, users: usersCount, deposits: depositsCount, withdrawals: withdrawalsCount })
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load dashboard'
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

  const cards = [
    {
      title: 'Bots',
      value: stats.bots,
      icon: Bot,
      iconColor: '#3B82F6',
      iconBg: 'rgba(59,130,246,0.15)'
    },
    {
      title: 'Bot users',
      value: stats.users,
      icon: Users,
      iconColor: '#6366F1',
      iconBg: 'rgba(99,102,241,0.15)'
    },
    {
      title: 'Deposits',
      value: stats.deposits,
      icon: DollarSign,
      iconColor: '#10B981',
      iconBg: 'rgba(16,185,129,0.15)'
    },
    {
      title: 'Withdrawals',
      value: stats.withdrawals,
      icon: TrendingUp,
      iconColor: '#8B5CF6',
      iconBg: 'rgba(139,92,246,0.15)'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Your platform overview</p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <Zap size={14} />
          Live
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          fontSize: '13px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#FCA5A5',
          borderRadius: '10px',
          padding: '12px'
        }}>
          <Zap size={16} style={{ marginTop: '1px' }} />
          <div>{error}</div>
        </div>
      )}

      <div
        className="dashboard-grid"
        style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '14px'
      }}
      >
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className="fade-up"
              style={{
                animationDelay: `${index * 60}ms`,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: card.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={18} color={card.iconColor} />
                </div>
              </div>

              {loading ? (
                <div className="skeleton" style={{ height: '80px', width: '100%' }} />
              ) : (
                <>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {card.value}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{card.title}</div>
                  <div style={{
                    marginTop: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '999px',
                    padding: '4px 8px'
                  }}>
                    <ArrowUpRight size={12} />
                    —
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <Link href="/dashboard/advertise" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.12) 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '16px',
          padding: '20px 24px',
          cursor: 'pointer',
          transition: 'opacity 0.15s'
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Megaphone size={20} color='white'/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              📣 Advertise on 1-TouchBot
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Reach thousands of active bot users across the network
            </div>
          </div>
          <ArrowUpRight size={18} color='var(--text-muted)'/>
        </div>
      </Link>

      <style>{`
        @media (min-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}

