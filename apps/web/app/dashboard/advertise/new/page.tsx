'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Megaphone, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [title, setTitle] = useState('')
  const [messageText, setMessageText] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [targetCategory, setTargetCategory] = useState('all')
  const [budgetUsd, setBudgetUsd] = useState<number>(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function create() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const advertiserId = auth.user?.id
      if (!advertiserId) throw new Error('Not authenticated')

      const { error: cErr } = await supabase.from('ad_campaigns').insert({
        advertiser_id: advertiserId,
        title,
        message_text: messageText,
        button_text: buttonText || null,
        button_url: buttonUrl || null,
        target_category: targetCategory,
        budget_usd: budgetUsd,
        spent_usd: 0,
        cost_per_impression_usd: 0.001,
        is_active: false,
        is_paid: false
      })
      if (cErr) throw cErr
      setSuccess('Campaign created.')
      toast.success('Campaign created successfully!')
      router.push('/dashboard/advertise')
    } catch (e: any) {
      const message = e?.message || 'Failed to create campaign'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New campaign</h1>
        <p className="text-sm text-gray-600 mt-1">Create a sponsored message to show inside bots.</p>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="flex gap-2 items-start text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg p-3">
          <CheckCircle size={18} className="mt-0.5" />
          <div>{success}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Megaphone size={18} />
          Campaign
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Message text</label>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="mt-1 w-full min-h-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            placeholder="Your sponsored message..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Button text (optional)</label>
            <input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              placeholder="Learn more"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Button URL (optional)</label>
            <input
              value={buttonUrl}
              onChange={(e) => setButtonUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Target category</label>
            <input
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              placeholder="all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Budget (USD)</label>
            <input
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(Number(e.target.value))}
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={create}
            disabled={loading || !title || !messageText}
            loading={loading}
            loadingText="Creating..."
            variant="primary"
          >
            <Plus size={18} />
            Create campaign
          </Button>
        </div>
      </div>
    </div>
  )
}

