'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Plus, Bot as BotIcon } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AddBotPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [token, setToken] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome! Use the buttons below to get started.')
  const [currencyName, setCurrencyName] = useState('Coins')
  const [currencySymbol, setCurrencySymbol] = useState('🪙')
  const [usdRate, setUsdRate] = useState(1000)
  const [category, setCategory] = useState('general')
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupStep, setSetupStep] = useState<0 | 1 | 2 | 3>(0)
  const [error, setError] = useState<string | null>(null)

  async function validateToken() {
    setTokenStatus('loading')
    setError(null)
    try {
      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://botifypro-engine.onrender.com'
      const resp = await axios.post(`${BOT_ENGINE_URL}/api/bots/validate`, { token })
      if (!resp.data?.valid) {
        setTokenStatus('error')
        toast.error('Invalid token')
        return
      }
      setTokenStatus('success')
      toast.success('Bot token verified successfully!')
    } catch (e: any) {
      setTokenStatus('error')
      toast.error(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Invalid token')
    }
  }

  async function completeSetup() {
    setSetupLoading(true)
    setError(null)
    setSetupStep(1)
    let stepTimer: number | undefined
    stepTimer = window.setTimeout(() => setSetupStep(2), 700)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const creatorId = auth.user?.id
      const email = auth.user?.email
      if (!creatorId) throw new Error('Not authenticated')

      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://botifypro-engine.onrender.com'
      const resp = await axios.post(`${BOT_ENGINE_URL}/api/bots/register`, {
        token,
        creatorId,
        email,
        welcomeMessage,
        currencyName,
        currencySymbol,
        usdRate,
        category
      })
      setSetupStep(3)
      toast.success('Bot created successfully!')
      router.push(`/dashboard/bots/${resp.data.id}/settings`)
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Registration failed'
      setSetupStep(0)
      toast.error(message)
      setError(message)
    } finally {
      if (stepTimer) window.clearTimeout(stepTimer)
      setSetupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Add bot</h1>
        <p className="text-sm text-gray-600 mt-1">Connect your Telegram bot token to BotifyPro.</p>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          <AlertCircle size={18} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <BotIcon size={18} />
          Bot details
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bot token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            placeholder="123456:ABCDEF..."
          />
          <div className="mt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!token || setupLoading}
              loading={tokenStatus === 'loading'}
              loadingText="Validating token..."
              onClick={validateToken}
            >
              <CheckCircle size={18} />
              Verify Token
            </Button>

            {tokenStatus !== 'idle' && (
              <div className="mt-3">
                {tokenStatus === 'loading' && <StatusBadge status="loading" text="Checking token..." />}
                {tokenStatus === 'success' && <StatusBadge status="success" text="Token verified ✓" />}
                {tokenStatus === 'error' && <StatusBadge status="error" text="Invalid token" />}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency name</label>
            <input
              value={currencyName}
              onChange={(e) => setCurrencyName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency symbol</label>
            <input
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">USD to currency rate</label>
            <input
              value={usdRate}
              onChange={(e) => setUsdRate(Number(e.target.value))}
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              placeholder="general"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Welcome message</label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="mt-1 w-full min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            disabled={setupLoading || tokenStatus !== 'success' || !token}
            loading={setupLoading}
            loadingText="Creating your bot..."
            onClick={completeSetup}
          >
            <Plus size={18} />
            Complete Setup
          </Button>
        </div>

        {setupStep > 0 && (
          <div className="pt-2 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              {setupStep === 1 && <LoadingSpinner size={16} color="#2563eb" />}
              {setupStep >= 2 && <CheckCircle size={16} color="#16a34a" />}
              Step 1: Saving bot settings...
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              {setupStep === 2 && <LoadingSpinner size={16} color="#2563eb" />}
              {setupStep >= 3 && <CheckCircle size={16} color="#16a34a" />}
              Step 2: Registering webhook with Telegram...
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              {setupStep >= 3 && <CheckCircle size={16} color="#16a34a" />}
              Step 3: Bot is ready!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

