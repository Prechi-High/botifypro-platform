'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Megaphone, Plus } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdvertisePage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) throw new Error('Not authenticated')

        const { data, error: cErr } = await supabase
          .from('ad_campaigns')
          .select('id, title, budget_usd, spent_usd, is_active, is_paid, target_category, created_at')
          .eq('advertiser_id', userId)
          .order('created_at', { ascending: false })
        if (cErr) throw cErr
        if (cancelled) return
        setCampaigns(data || [])
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load campaigns'
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Advertise</h1>
          <p className="text-sm text-gray-600 mt-1">Create and manage ad campaigns.</p>
        </div>
        <Link
          href="/dashboard/advertise/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={18} />
          New campaign
        </Link>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Megaphone size={18} />
          Your campaigns
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-sm text-gray-600">Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No campaigns yet.</div>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{c.title}</div>
                  <div className="text-sm text-gray-600">
                    Budget: ${c.budget_usd} · Spent: ${c.spent_usd} · Target: {c.target_category}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      'text-xs font-medium px-2 py-1 rounded-full border ' +
                      (c.is_paid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200')
                    }
                  >
                    {c.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                  <span
                    className={
                      'text-xs font-medium px-2 py-1 rounded-full border ' +
                      (c.is_active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200')
                    }
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

