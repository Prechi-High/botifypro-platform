'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, Bot, Users, DollarSign, AlertCircle } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Your platform overview.</p>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Bots" value={stats.bots} icon={<Bot size={18} />} loading={loading} />
        <StatCard title="Bot users" value={stats.users} icon={<Users size={18} />} loading={loading} />
        <StatCard title="Deposits" value={stats.deposits} icon={<DollarSign size={18} />} loading={loading} />
        <StatCard title="Withdrawals" value={stats.withdrawals} icon={<BarChart2 size={18} />} loading={loading} />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  loading
}: {
  title: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{title}</div>
        <div className="text-gray-500">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-gray-900">{loading ? '—' : value}</div>
    </div>
  )
}

