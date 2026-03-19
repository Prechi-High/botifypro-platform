'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, BarChart2, CheckCircle, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminCampaignsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: cErr } = await supabase
          .from('ad_campaigns')
          .select('id, title, advertiser_id, budget_usd, spent_usd, is_active, is_paid, target_category, created_at')
          .order('created_at', { ascending: false })
        if (cErr) throw cErr
        if (cancelled) return
        setCampaigns(data || [])
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load admin campaigns'
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

  async function toggleActive(id: string, next: boolean) {
    setSavingId(id)
    setError(null)
    try {
      const { error: upErr } = await supabase.from('ad_campaigns').update({ is_active: next }).eq('id', id)
      if (upErr) throw upErr
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: next } : c)))
      toast.success('Campaign updated!')
    } catch (e: any) {
      const message = e?.message || 'Update failed'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function togglePaid(id: string, next: boolean) {
    setSavingId(id)
    setError(null)
    try {
      const { error: upErr } = await supabase.from('ad_campaigns').update({ is_paid: next }).eq('id', id)
      if (upErr) throw upErr
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, is_paid: next } : c)))
      toast.success('Campaign updated!')
    } catch (e: any) {
      const message = e?.message || 'Update failed'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin campaigns</h1>
        <p className="text-sm text-gray-600 mt-1">Review and enable paid campaigns.</p>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700">
          <BarChart2 size={18} />
          All campaigns
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-4 text-sm text-gray-600">Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No campaigns.</div>
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
                  <Button
                    variant={c.is_paid ? 'success' : 'secondary'}
                    disabled={savingId === c.id}
                    loading={savingId === c.id}
                    loadingText="Updating..."
                    onClick={() => togglePaid(c.id, !c.is_paid)}
                  >
                    {c.is_paid ? <CheckCircle size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
                    {c.is_paid ? 'Paid' : 'Mark paid'}
                  </Button>
                  <Button
                    variant={c.is_active ? 'success' : 'secondary'}
                    disabled={savingId === c.id}
                    loading={savingId === c.id}
                    loadingText="Updating..."
                    onClick={() => toggleActive(c.id, !c.is_active)}
                  >
                    {c.is_active ? <CheckCircle size={18} color="#2563eb" /> : <XCircle size={18} color="#dc2626" />}
                    {c.is_active ? 'Active' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

