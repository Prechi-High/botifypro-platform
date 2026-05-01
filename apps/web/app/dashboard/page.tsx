'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bot, Users, Terminal, CheckSquare, RefreshCw, Send, CircleHelp } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

type Stats = {
  totalBots: number
  activeUsers: number
  commands: number
  workingBots: number
}

type HourlyData = { hour: string; users: number }
type TopBot = { name: string; username: string; users: number }

// Build 6 hourly slots ending at current hour
function buildSixHourSlots(): HourlyData[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getTime() - (5 - i) * 60 * 60 * 1000)
    return { hour: `${String(d.getHours()).padStart(2, '0')}:00`, users: 0 }
  })
}

function MiniLineChart({ data }: { data: HourlyData[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; hour: string; users: number } | null>(null)
  const max = Math.max(...data.map(d => d.users), 4)
  const w = 320
  const h = 120
  const pad = { top: 10, right: 10, bottom: 30, left: 28 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * innerW
    const y = pad.top + innerH - (d.users / max) * innerH
    return { x, y, ...d }
  })

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  const yLabels = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i)).filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '140px' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {yLabels.map(v => {
          const y = pad.top + innerH - (v / max) * innerH
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,3" />
              <text x={pad.left - 6} y={y + 4} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="end">{v}</text>
            </g>
          )
        })}
        <polyline points={polylinePoints} fill="none" stroke="#7C3AED" strokeWidth="2" />
        {/* Invisible hit areas for each data point */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={8} fill="transparent"
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, hour: p.hour, users: p.users })}
          />
        ))}
        {/* Visible dot on hover */}
        {tooltip && (
          <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#7C3AED" stroke="white" strokeWidth="1.5" />
        )}
        {data.map((d, i) => {
          const x = pad.left + (i / Math.max(data.length - 1, 1)) * innerW
          return (
            <text key={i} x={x} y={h - 6} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle">
              {d.hour}
            </text>
          )
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: `${(tooltip.x / 320) * 100}%`,
          top: `${(tooltip.y / 120) * 100}%`,
          transform: 'translate(-50%, -130%)',
          background: 'rgba(30,20,50,0.95)',
          border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '12px',
          color: 'white',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 600, color: '#A78BFA' }}>{tooltip.hour}</div>
          <div>{tooltip.users} active user{tooltip.users !== 1 ? 's' : ''}</div>
        </div>
      )}
    </div>
  )
}

export default function DashboardHome() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ totalBots: 0, activeUsers: 0, commands: 0, workingBots: 0 })
  const [hourlyData, setHourlyData] = useState<HourlyData[]>(buildSixHourSlots())
  const [chartStats, setChartStats] = useState({ totalUsers: 0, peakHour: 0, avgPerHour: 0, activeHours: 0 })
  const [topBots, setTopBots] = useState<TopBot[]>([])

  async function load() {
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) return

      const botsRes = await supabase
        .from('bots')
        .select('id, bot_username, bot_name, is_active')
        .eq('creator_id', userId)
      const bots = botsRes.data || []
      const botIds = bots.map((b: any) => b.id)
      const totalBots = bots.length
      const workingBots = bots.filter((b: any) => b.is_active).length

      let activeUsers = 0
      let commands = 0
      let topBotsData: TopBot[] = []
      const slots = buildSixHourSlots()

      if (botIds.length > 0) {
        // Active users in last 6h
        const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const activeRes = await supabase
          .from('bot_users')
          .select('id', { count: 'exact', head: true })
          .in('bot_id', botIds)
          .gte('last_active', since6h)
        activeUsers = activeRes.count || 0

        // Total active commands: DB commands + enabled built-in commands from settings
        const cmdRes = await supabase
          .from('bot_commands')
          .select('id', { count: 'exact', head: true })
          .in('bot_id', botIds)
          .eq('is_active', true)
        const dbCommands = cmdRes.count || 0

        // Count enabled built-in commands from settings
        const settingsRes = await supabase
          .from('bot_settings')
          .select('withdraw_enabled, deposit_enabled, referral_enabled, balance_enabled, daily_bonus_enabled, bonus_enabled, leaderboard_enabled')
          .in('bot_id', botIds)
        const settingsRows = settingsRes.data || []
        let builtinCount = 0
        for (const s of settingsRows) {
          builtinCount += 2 // Balance + Referral always on
          if (s.withdraw_enabled) builtinCount++
          if (s.deposit_enabled) builtinCount++
          if (s.daily_bonus_enabled || s.bonus_enabled) builtinCount++
          if (s.leaderboard_enabled) builtinCount++
        }
        commands = dbCommands + builtinCount

        // Hourly activity for last 6h — fetch bot_users active per hour slot
        for (let i = 0; i < slots.length; i++) {
          const slotStart = new Date(Date.now() - (5 - i) * 60 * 60 * 1000)
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)
          const res = await supabase
            .from('bot_users')
            .select('id', { count: 'exact', head: true })
            .in('bot_id', botIds)
            .gte('last_active', slotStart.toISOString())
            .lt('last_active', slotEnd.toISOString())
          slots[i].users = res.count || 0
        }

        // Chart summary stats
        const totalUsersChart = slots.reduce((s, d) => s + d.users, 0)
        const peakSlot = slots.reduce((best, d) => d.users > best.users ? d : best, slots[0])
        const activeHoursCount = slots.filter(d => d.users > 0).length
        const avgPerHour = activeHoursCount > 0 ? Math.round(totalUsersChart / activeHoursCount) : 0
        setChartStats({
          totalUsers: totalUsersChart,
          peakHour: peakSlot.users,
          avgPerHour,
          activeHours: activeHoursCount,
        })

        // Top bots by total user count
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

      setStats({ totalBots, activeUsers, commands, workingBots })
      setHourlyData(slots)
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
      sub: 'Active in last 6 hours',
      icon: Users,
      iconColor: '#34D399',
      iconBg: 'rgba(16,185,129,0.18)',
    },
    {
      label: 'COMMANDS',
      value: stats.commands,
      sub: 'Total active commands',
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
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Welcome to your 1-TouchBot control center
        </p>
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

      {/* Stat cards — 2x2 grid */}
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

      {/* User Activity Chart — last 6h */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px',
      }}>
        <div style={{ marginBottom: '4px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          User Activity (6h)
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
            { label: 'Total Users', value: chartStats.totalUsers, color: 'var(--text-primary)' },
            { label: 'Peak Hour', value: chartStats.peakHour, color: '#34D399' },
            { label: 'Avg/Hour', value: chartStats.avgPerHour, color: '#818CF8' },
            { label: 'Active Hours', value: chartStats.activeHours, color: '#60A5FA' },
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{topBots.length} bots</span>
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
          <a href="https://t.me/+xse0lboY9m03MjQ0" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '16px',
              cursor: 'pointer',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(14,165,233,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Send size={20} color="#38BDF8" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Telegram Community</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Join our group for help &amp; updates</div>
              </div>
            </div>
          </a>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '16px',
            cursor: 'pointer',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CircleHelp size={20} color="#34D399" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Get Support</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Ask questions &amp; get help</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
