'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bot, Users, Terminal, CheckSquare, Copy, ArrowLeftRight, RefreshCw, Send, BookOpen, CircleHelp } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

type Stats = {
  totalBots: number
  activeUsers: number
  commands: number
  workingBots: number
  clonedBots: number
  transferred: number
}

type HourlyData = { hour: string; users: number }

type TopBot = { name: string; username: string; users: number }

const HOURS = ['00:00','06:00','11:00','16:00','23:00']

function generateHourlyData(): HourlyData[] {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    users: 0,
  }))
}

function MiniLineChart({ data }: { data: HourlyData[] }) {
  const max = Math.max(...data.map(d => d.users), 4)
  const w = 320
  const h = 120
  const pad = { top: 10, right: 10, bottom: 30, left: 28 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const points = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * innerW
    const y = pad.top + innerH - (d.users / max) * innerH
    return `${x},${y}`
  }).join(' ')

  const yLabels = [0, 1, 2, 3, 4].filter(v => v <= max)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '140px' }}>
      {/* Y grid lines */}
      {yLabels.map(v => {
        const y = pad.top + innerH - (v / max) * innerH
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pad.left - 6} y={y + 4} fill="rgba(255,255,255,0.3)"
              fontSize="9" textAnchor="end">{v}</text>
          </g>
        )
      })}
      {/* Line */}
      <polyline points={points} fill="none" stroke="#7C3AED" strokeWidth="2" />
      {/* X labels */}
      {HOURS.map((label, i) => {
        const idx = i === 0 ? 0 : i === 1 ? 6 : i === 2 ? 11 : i === 3 ? 16 : 23
        const x = pad.left + (idx / (data.length - 1)) * innerW
        return (
          <text key={label} x={x} y={h - 6} fill="rgba(255,255,255,0.3)"
            fontSize="9" textAnchor="middle">{label}</text>
        )
      })}
    </svg>
  )
}

export default function DashboardHome() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalBots: 0, activeUsers: 0, commands: 0,
    workingBots: 0, clonedBots: 0, transferred: 0,
  })
  const [hourlyData] = useState<HourlyData[]>(generateHourlyData())
  const [topBots, setTopBots] = useState<TopBot[]>([])

  async function load() {
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) return

      const botsRes = await supabase.from('bots').select('id, bot_username, bot_name, is_active').eq('creator_id', userId)
      const bots = botsRes.data || []
      const botIds = bots.map((b: any) => b.id)
      const totalBots = bots.length
      const workingBots = bots.filter((b: any) => b.is_active).length

      let activeUsers = 0
      let topBotsData: TopBot[] = []

      if (botIds.length > 0) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const activeRes = await supabase
          .from('bot_users')
          .select('id', { count: 'exact', head: true })
          .in('bot_id', botIds)
          .gte('last_active', since24h)
        activeUsers = activeRes.count || 0

        // Top bots by user count
        for (const bot of bots.slice(0, 5)) {
          const countRes = await supabase
            .from('bot_users')
            .select('id', { count: 'exact', head: true })
            .eq('bot_id', bot.id)
          topBotsData.push({
            name: bot.bot_name || bot.bot_username || 'Unnamed Bot',
            username: bot.bot_username || '',
            users: countRes.count || 0,
          })
        }
        topBotsData.sort((a, b) => b.users - a.users)
      }

      setStats({
        totalBots,
        activeUsers,
        commands: 0,
        workingBots,
        clonedBots: 0,
        transferred: 0,
      })
      setTopBots(topBotsData)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [supabase])

  const statCards = [
    {
      label: 'TOTAL BOTS',
      value: stats.totalBots,
      sub: 'All bots in your account',
      icon: Bot,
      iconColor: '#818CF8',
      iconBg: 'rgba(99,102,241,0.18)',
    },
    {
      label: 'ACTIVE USERS',
      value: stats.activeUsers,
      sub: 'Active in last 24 hours',
      icon: Users,
      iconColor: '#34D399',
      iconBg: 'rgba(16,185,129,0.18)',
    },
    {
      label: 'COMMANDS',
      value: stats.commands,
      sub: 'Executed in last 24h',
      icon: Terminal,
      iconColor: '#60A5FA',
      iconBg: 'rgba(59,130,246,0.18)',
    },
    {
      label: 'WORKING',
      value: stats.workingBots,
      sub: `${stats.totalBots > 0 ? Math.round((stats.workingBots / stats.totalBots) * 100) : 0}% of total bots`,
      icon: CheckSquare,
      iconColor: '#FBBF24',
      iconBg: 'rgba(245,158,11,0.18)',
    },
    {
      label: 'CLONED BOTS',
      value: stats.clonedBots,
      sub: 'Cloned from templates',
      icon: Copy,
      iconColor: '#2DD4BF',
      iconBg: 'rgba(20,184,166,0.18)',
    },
    {
      label: 'TRANSFERRED',
      value: stats.transferred,
      sub: 'From other accounts',
      icon: ArrowLeftRight,
      iconColor: '#F87171',
      iconBg: 'rgba(239,68,68,0.18)',
    },
  ]

  const totalUsers = 0
  const peakHour = 0
  const avgPerHour = 0
  const activeHours = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Welcome to your 1-TouchBot control center
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
        <Link href="/dashboard/bots" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', borderRadius: '12px',
            background: '#7C3AED', border: 'none',
            color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
          }}>
            <Bot size={16} /> My Bots
          </button>
        </Link>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {card.label}
                </span>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: card.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={card.iconColor} />
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: '40px', width: '60%', borderRadius: '8px' }} />
              ) : (
                <>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {card.sub}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* User Activity Chart */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px',
      }}>
        <div style={{ marginBottom: '4px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          User Activity (24h)
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Hourly user engagement overview
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7C3AED' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Users</span>
        </div>
        <MiniLineChart data={hourlyData} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
          {[
            { label: 'Total Users', value: totalUsers, color: 'var(--text-primary)' },
            { label: 'Peak Hour', value: peakHour, color: '#34D399' },
            { label: 'Avg/Hour', value: avgPerHour, color: '#818CF8' },
            { label: 'Active Hours', value: activeHours, color: '#60A5FA' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Active Bots */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Top Active Bots
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {topBots.length} bots
          </span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>BOT</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>USERS</span>
          </div>
          {loading ? (
            <div style={{ padding: '20px 16px' }}>
              <div className="skeleton" style={{ height: '20px', width: '80%', borderRadius: '6px' }} />
            </div>
          ) : topBots.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '32px 16px', gap: '8px',
            }}>
              <Bot size={28} color="rgba(255,255,255,0.1)" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active bots</span>
            </div>
          ) : (
            topBots.map((bot, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                padding: '12px 16px',
                borderBottom: i < topBots.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{bot.name}</div>
                  {bot.username && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{bot.username}</div>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{bot.users}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Help & Support */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Help &amp; Support
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            {
              title: 'Telegram Community',
              desc: 'Join our group for help & updates',
              icon: Send,
              iconColor: '#38BDF8',
              iconBg: 'rgba(14,165,233,0.15)',
            },
            {
              title: 'Learn to Make Bots',
              desc: 'Tutorials & guides to get started',
              icon: BookOpen,
              iconColor: '#A78BFA',
              iconBg: 'rgba(139,92,246,0.15)',
            },
            {
              title: 'Get Support',
              desc: 'Ask questions & get help',
              icon: CircleHelp,
              iconColor: '#34D399',
              iconBg: 'rgba(16,185,129,0.15)',
            },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.title} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '16px',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: item.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} color={item.iconColor} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
