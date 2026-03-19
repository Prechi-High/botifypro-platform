'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Settings as SettingsIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function BotSettingsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://botifypro-engine.onrender.com'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingChannel, setFetchingChannel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [botToken, setBotToken] = useState<string>('')

  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [currencyName, setCurrencyName] = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('')
  const [usdToCurrencyRate, setUsdToCurrencyRate] = useState<number>(1000)
  const [minDepositUsd, setMinDepositUsd] = useState<number>(1)
  const [minWithdrawUsd, setMinWithdrawUsd] = useState<number>(0.5)
  const [withdrawFeePercent, setWithdrawFeePercent] = useState<number>(0)
  const [oxapayMerchantKey, setOxapayMerchantKey] = useState<string>('')
  const [requireChannelJoin, setRequireChannelJoin] = useState<boolean>(false)
  const [requiredChannelId, setRequiredChannelId] = useState<string>('')
  const [requiredChannelUsername, setRequiredChannelUsername] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: botRow, error: botTokenErr } = await supabase
          .from('bots')
          .select('bot_token')
          .eq('id', botId)
          .single()
        if (botTokenErr) throw botTokenErr

        const { data, error: botErr } = await supabase
          .from('bot_settings')
          .select('*')
          .eq('bot_id', botId)
          .single()
        if (botErr) throw botErr
        if (cancelled) return
        setBotToken(botRow?.bot_token || '')
        setWelcomeMessage(data.welcome_message)
        setCurrencyName(data.currency_name)
        setCurrencySymbol(data.currency_symbol)
        setUsdToCurrencyRate(Number(data.usd_to_currency_rate))
        setMinDepositUsd(Number(data.min_deposit_usd))
        setMinWithdrawUsd(Number(data.min_withdraw_usd))
        setWithdrawFeePercent(Number(data.withdraw_fee_percent))
        setOxapayMerchantKey(data.oxapay_merchant_key || '')
        setRequireChannelJoin(Boolean(data.require_channel_join))
        setRequiredChannelId(data.required_channel_id || '')
        setRequiredChannelUsername(data.required_channel_username || '')
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load settings'
        setError(message)
        toast.error(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (botId) load()
    return () => {
      cancelled = true
    }
  }, [botId, supabase])

  async function fetchChannelId(username: string) {
    setFetchingChannel(true)
    try {
      const cleanUsername = username.startsWith('@') ? username : '@' + username
      const response = await fetch(`${BOT_ENGINE_URL}/api/bots/channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, botToken })
      })
      const data = await response.json()
      if (data.channelId) {
        setRequiredChannelId(data.channelId)
        toast.success('Channel ID found: ' + data.channelId)
      } else {
        toast.error('Could not find channel. Make sure the username is correct and our platform bot is admin there.')
      }
    } catch {
      toast.error('Failed to fetch channel info')
    }
    setFetchingChannel(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: upErr } = await supabase
        .from('bot_settings')
        .update({
          welcome_message: welcomeMessage,
          currency_name: currencyName,
          currency_symbol: currencySymbol,
          usd_to_currency_rate: usdToCurrencyRate,
          min_deposit_usd: minDepositUsd,
          min_withdraw_usd: minWithdrawUsd,
          withdraw_fee_percent: withdrawFeePercent,
          oxapay_merchant_key: oxapayMerchantKey || null,
          require_channel_join: requireChannelJoin,
          required_channel_id: requiredChannelId || null,
          required_channel_username: requiredChannelUsername || null
        })
        .eq('bot_id', botId)
      if (upErr) throw upErr
      setSuccess('Settings saved.')
      toast.success('Settings saved!')
    } catch (e: any) {
      const message = e?.message || 'Failed to save'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bot settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Configure behavior, currency, and payments.{' '}
          <Link href={`/dashboard/bots/${botId}/commands`} className="text-blue-600 hover:text-blue-700 font-medium">
            Custom Commands
          </Link>
        </p>
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
          <SettingsIcon size={18} />
          Settings
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Welcome message</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="mt-1 w-full min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
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
                  value={usdToCurrencyRate}
                  onChange={(e) => setUsdToCurrencyRate(Number(e.target.value))}
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Min deposit (USD)</label>
                <input
                  value={minDepositUsd}
                  onChange={(e) => setMinDepositUsd(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Min withdraw (USD)</label>
                <input
                  value={minWithdrawUsd}
                  onChange={(e) => setMinWithdrawUsd(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Withdraw fee (%)</label>
                <input
                  value={withdrawFeePercent}
                  onChange={(e) => setWithdrawFeePercent(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">OxaPay merchant key</label>
                <input
                  value={oxapayMerchantKey}
                  onChange={(e) => setOxapayMerchantKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Require channel join</div>
                  <div className="text-xs text-gray-600">Force users to join a channel before using the bot.</div>
                </div>
                <input
                  type="checkbox"
                  checked={requireChannelJoin}
                  onChange={(e) => setRequireChannelJoin(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Channel Username</label>
                    <input
                      value={requiredChannelUsername}
                      onChange={(e) => setRequiredChannelUsername(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      placeholder="@mychannel"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchChannelId(requiredChannelUsername)}
                    disabled={fetchingChannel || !requiredChannelUsername || !botToken}
                    loading={fetchingChannel}
                    loadingText="Fetching..."
                  >
                    Get ID
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Channel ID (auto-filled)</label>
                  <input
                    value={requiredChannelId}
                    onChange={(e) => setRequiredChannelId(e.target.value)}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                    placeholder="-1001234567890"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={save}
                disabled={saving}
                loading={saving}
                loadingText="Saving..."
                variant="primary"
              >
                Save settings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

