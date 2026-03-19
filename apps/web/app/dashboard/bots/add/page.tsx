'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Plus, Bot as BotIcon } from 'lucide-react'

export default function AddBotPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [token, setToken] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome! Use the buttons below to get started.')
  const [currencyName, setCurrencyName] = useState('Coins')
  const [currencySymbol, setCurrencySymbol] = useState('🪙')
  const [usdRate, setUsdRate] = useState(1000)
  const [category, setCategory] = useState('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function validateToken() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://botifypro-engine.onrender.com'
      const base = BOT_ENGINE_URL
      const resp = await axios.post(`${base}/api/bots/validate`, { token })
      if (!resp.data?.valid) {
        setError(resp.data?.error || 'Invalid token')
        return
      }
      setSuccess(`Valid bot: @${resp.data.username}`)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  async function register() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const creatorId = auth.user?.id
      if (!creatorId) throw new Error('Not authenticated')

      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://botifypro-engine.onrender.com'
      const base = BOT_ENGINE_URL

      const resp = await axios.post(`${base}/api/bots/register`, {
        token,
        creatorId,
        welcomeMessage,
        currencyName,
        currencySymbol,
        usdRate,
        category
      })
      setSuccess('Bot registered successfully.')
      router.push(`/dashboard/bots/${resp.data.id}/settings`)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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

      {success && (
        <div className="flex gap-2 items-start text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg p-3">
          <CheckCircle size={18} className="mt-0.5" />
          <div>{success}</div>
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
            <button
              type="button"
              disabled={loading || !token}
              onClick={validateToken}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} />
              Validate token
            </button>
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
          <button
            type="button"
            disabled={loading || !token}
            onClick={register}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            {loading ? 'Registering...' : 'Register bot'}
          </button>
        </div>
      </div>
    </div>
  )
}

