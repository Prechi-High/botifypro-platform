"use client"

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Zap, Hand, Eye, EyeOff, AlertTriangle, MessageSquare, Shield, Coins, Radio, ArrowUpFromLine, CheckCircle, XCircle } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

function ToggleRow({ label, desc, enabled, onToggle }: {
  label: string; desc: string; enabled: boolean; onToggle: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>{label}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{desc}</div>
      </div>
      <div className={`toggle-track ${enabled ? 'on' : 'off'}`} onClick={onToggle} style={{ flexShrink: 0 }}>
        <div className="toggle-thumb" />
      </div>
    </div>
  )
}

export default function BotSettingsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [botUsername, setBotUsername] = useState('')

  const [webhookStatus, setWebhookStatus] = useState(false)
  const [checkingWebhook, setCheckingWebhook] = useState(false)
  const [fixingWebhook, setFixingWebhook] = useState(false)

  // Welcome
  const [welcomeEnabled, setWelcomeEnabled] = useState(false)
  const [welcomeMessage, setWelcomeMessage] = useState('')

  // Security
  const [captchaEnabled, setCaptchaEnabled] = useState(true)

  // Currency
  const [currencyName, setCurrencyName] = useState('Coins')
  const [currencySymbol, setCurrencySymbol] = useState('🪙')
  const [usdToCurrencyRate, setUsdToCurrencyRate] = useState(1000)

  // Channels
  const [requireChannelJoin, setRequireChannelJoin] = useState(false)
  const [requiredChannels, setRequiredChannels] = useState<any[]>([])
  const [newChannelUsername, setNewChannelUsername] = useState('')
  const [addingChannel, setAddingChannel] = useState(false)
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')

  // Withdrawal
  const [withdrawMode, setWithdrawMode] = useState<'manual' | 'automatic' | null>(null)
  const [withdrawProvider, setWithdrawProvider] = useState<'faucetpay' | 'oxapay'>('faucetpay')
  const [minWithdrawUsd, setMinWithdrawUsd] = useState(0.5)
  const [withdrawFeePercent, setWithdrawFeePercent] = useState(0)
  const [withdrawalPassphrase, setWithdrawalPassphrase] = useState('')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [faucetpayConfigured, setFaucetpayConfigured] = useState(false)
  const [faucetpayMaskedKey, setFaucetpayMaskedKey] = useState('')
  const [faucetpayPayoutCurrency, setFaucetpayPayoutCurrency] = useState('USDT')
  const [oxapayConfigured, setOxapayConfigured] = useState(false)
  const [oxapayMaskedKey, setOxapayMaskedKey] = useState('')
  const [keyDialog, setKeyDialog] = useState<null | { provider: 'faucetpay' | 'oxapay'; mode: 'set' | 'replace' | 'remove' }>(null)
  const [paymentKeyInput, setPaymentKeyInput] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [submittingPaymentKey, setSubmittingPaymentKey] = useState(false)

  // Pro/VIP Investment Plan
  const [proOxapayConfigured, setProOxapayConfigured] = useState(false)
  const [proOxapayKeyInput, setProOxapayKeyInput] = useState('')
  const [savingProOxapay, setSavingProOxapay] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bots/${botId}/settings`, { cache: 'no-store' })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load settings')
        if (cancelled) return

        setBotToken(payload.botToken || '')
        setBotUsername(payload.botUsername || 'your bot')
        setWebhookStatus(Boolean(payload.webhookStatus))
        setUserPlan(payload.userPlan === 'pro' ? 'pro' : 'free')

        const data = payload.settings || {}
        const msg = data.welcomeMessage || ''
        setWelcomeMessage(msg)
        setWelcomeEnabled(!!msg)

        setCaptchaEnabled(data.captchaEnabled ?? true)

        setCurrencyName(data.currencyName || 'Coins')
        setCurrencySymbol(data.currencySymbol || '🪙')
        setUsdToCurrencyRate(Number(data.usdToCurrencyRate) || 1000)

        const channels = data.requiredChannels
        setRequiredChannels(Array.isArray(channels) ? channels : [])
        setRequireChannelJoin(Boolean(data.requireChannelJoin))
        setMinWithdrawUsd(Number(data.minWithdrawUsd) || 0.5)
        setWithdrawFeePercent(Number(data.withdrawFeePercent) || 0)
        setWithdrawMode(data.manualWithdrawal ? 'manual' : data.withdrawEnabled ? 'automatic' : null)
        setWithdrawProvider(data.withdrawProvider === 'oxapay' ? 'oxapay' : 'faucetpay')
        setWithdrawalPassphrase(data.withdrawalPassphrase || '')
        setFaucetpayConfigured(Boolean(data.faucetpayConfigured))
        setFaucetpayMaskedKey(data.faucetpayMaskedKey || '')
        setFaucetpayPayoutCurrency(data.faucetpayPayoutCurrency || 'USDT')
        setOxapayConfigured(Boolean(data.oxapayConfigured))
        setOxapayMaskedKey(data.oxapayMaskedKey || '')

        // Pro plan
        setProOxapayConfigured(Boolean(data.proOxapayConfigured))
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load settings'
        setError(message)
        toast.error(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [botId, supabase])

  async function checkWebhookStatus() {
    setCheckingWebhook(true)
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/bots/${botId}/webhook-status`)
      const data = await res.json()
      if (data.webhookSet) {
        toast.success(`Webhook active: ${data.url}`)
        setWebhookStatus(true)
      } else {
        toast.error(`Webhook not set. URL: ${data.url || 'none'}`)
        setWebhookStatus(false)
      }
    } catch (err: any) {
      toast.error('Failed to check webhook: ' + err.message)
    }
    setCheckingWebhook(false)
  }

  async function fixWebhook() {
    setFixingWebhook(true)
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/bots/register-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Webhook registered! Bot is now active.')
        setWebhookStatus(true)
      } else {
        toast.error('Failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err: any) {
      toast.error('Failed: ' + err.message)
    }
    setFixingWebhook(false)
  }

  const channelLimit = userPlan === 'pro' ? 10 : 4

  function parseChannelUsername(input: string): string {
    const trimmed = input.trim()
    const tmeLinkMatch = trimmed.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/)
    if (tmeLinkMatch) return '@' + tmeLinkMatch[1]
    if (trimmed.startsWith('@')) return trimmed
    if (trimmed.match(/^[A-Za-z0-9_]+$/)) return '@' + trimmed
    return trimmed
  }

  async function addChannel() {
    if (!newChannelUsername.trim()) return
    setAddingChannel(true)
    if (requiredChannels.length >= channelLimit) {
      toast.error(`Channel limit reached. ${userPlan === 'free' ? 'Free plan allows 4 channels. Upgrade to Pro for 10.' : 'Pro plan allows 10 channels.'}`)
      setAddingChannel(false)
      return
    }
    try {
      const clean = parseChannelUsername(newChannelUsername)

      const infoRes = await fetch(`${BOT_ENGINE_URL}/api/bots/channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, botToken })
      })
      const infoData = await infoRes.json()
      if (!infoData.channelId) {
        toast.error('Channel not found. Make sure username is correct.')
        setAddingChannel(false)
        return
      }

      const already = requiredChannels.some(c => c.id === infoData.channelId)
      if (already) {
        toast.error('Channel already added')
        setAddingChannel(false)
        return
      }

      const updated = [...requiredChannels, {
        id: infoData.channelId,
        username: infoData.username || clean,
        title: infoData.title || clean
      }]
      setRequiredChannels(updated)
      setNewChannelUsername('')
      toast.success('Channel added and verified ✓')
      try {
        const { error } = await supabase
          .from('bot_settings')
          .update({
            required_channels: updated,
            require_channel_join: true
          })
          .eq('bot_id', botId)
        if (error) throw error
        toast.success('Channel saved ✓')
      } catch (e: any) {
        toast.error('Channel added but failed to save: ' + e.message)
      }
    } catch {
      toast.error('Failed to add channel')
    }
    setAddingChannel(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bots/${botId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcomeEnabled,
          welcomeMessage,
          captchaEnabled,
          currencyName,
          currencySymbol,
          usdToCurrencyRate,
          requireChannelJoin,
          requiredChannels,
          minWithdrawUsd,
          withdrawFeePercent,
          withdrawMode,
          withdrawProvider,
          withdrawalPassphrase,
          // Pro plan
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to save')
      toast.success('Settings saved!')
    } catch (e: any) {
      const message = e?.message || 'Failed to save'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  function openKeyDialog(provider: 'faucetpay' | 'oxapay', mode: 'set' | 'replace' | 'remove') {
    setKeyDialog({ provider, mode })
    setPaymentKeyInput('')
    setCurrentPassword('')
  }

  function closeKeyDialog() {
    setKeyDialog(null)
    setPaymentKeyInput('')
    setCurrentPassword('')
    setSubmittingPaymentKey(false)
  }

  async function submitPaymentKey() {
    if (!keyDialog) return
    if (keyDialog.mode !== 'remove' && !paymentKeyInput.trim()) {
      toast.error('Enter the API key first')
      return
    }

    setSubmittingPaymentKey(true)
    try {
      const res = await fetch(`/api/bots/${botId}/payment-key`, {
        method: keyDialog.mode === 'remove' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: keyDialog.provider,
          apiKey: paymentKeyInput,
          currentPassword,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to update payment key')

      if (keyDialog.provider === 'faucetpay') {
        setFaucetpayConfigured(Boolean(payload.configured))
        setFaucetpayMaskedKey(payload.maskedKey || '')
        if (!payload.configured && withdrawProvider === 'faucetpay' && withdrawMode === 'automatic') {
          setWithdrawMode(null)
        }
      } else {
        setOxapayConfigured(Boolean(payload.configured))
        setOxapayMaskedKey(payload.maskedKey || '')
        if (!payload.configured && withdrawProvider === 'oxapay' && withdrawMode === 'automatic') {
          setWithdrawProvider('faucetpay')
          if (!faucetpayConfigured) setWithdrawMode(null)
        }
      }

      toast.success(
        keyDialog.mode === 'remove'
          ? `${keyDialog.provider === 'oxapay' ? 'OxaPay' : 'FaucetPay'} key removed`
          : `${keyDialog.provider === 'oxapay' ? 'OxaPay' : 'FaucetPay'} key saved`
      )
      closeKeyDialog()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update payment key')
      setSubmittingPaymentKey(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px',
    color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px'
  }
  const sectionCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px'
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: '14px', fontWeight: 600,
    color: 'var(--text-primary)', margin: '0 0 14px 0'
  }

  return (
    <div style={{ padding: '1.5rem', background: 'var(--bg-base)', minHeight: '100vh' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Bot settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Configure your bot.{' '}
          <Link href={`/dashboard/bots/${botId}/commands`} style={{ color: 'var(--blue-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Manage commands →
          </Link>
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', borderRadius: '8px', padding: '12px', marginBottom: '1rem' }}>
          <AlertCircle size={18} style={{ marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={sectionCardStyle}>
          <div className="skeleton" style={{ width: '100%', height: '120px' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Webhook status */}
          <div style={{
            background: webhookStatus ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${webhookStatus ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: '12px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {webhookStatus
                ? <CheckCircle size={16} style={{color:'#10B981'}} />
                : <XCircle size={16} style={{color:'#EF4444'}} />
              }
              <span style={{ fontSize: '13px', fontWeight: 500, color: webhookStatus ? '#10B981' : '#FCA5A5' }}>
                {webhookStatus ? 'Webhook active — bot is receiving messages' : 'Webhook not set — bot cannot receive messages'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={checkWebhookStatus} disabled={checkingWebhook} className="btn-ghost">
                {checkingWebhook ? 'Checking...' : 'Check'}
              </button>
              <button onClick={fixWebhook} disabled={fixingWebhook} className="btn-ghost">
                {fixingWebhook ? 'Fixing...' : 'Fix Webhook'}
              </button>
            </div>
          </div>

          {/* Welcome */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}><MessageSquare size={16} style={{marginRight:'8px',color:'#3B82F6'}} />Welcome Message</h3>
            <ToggleRow
              label="Send welcome message"
              desc="Show a message when users first start the bot"
              enabled={welcomeEnabled}
              onToggle={() => setWelcomeEnabled(!welcomeEnabled)}
            />
            {welcomeEnabled && (
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>Message</label>
                <textarea
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '88px' }}
                  placeholder="Welcome! Use the buttons below to get started."
                />
              </div>
            )}
          </div>

          {/* Security */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}><Shield size={16} style={{marginRight:'8px',color:'#3B82F6'}} />Security</h3>
            <ToggleRow
              label="Captcha verification"
              desc="New users must solve a math challenge before accessing the bot"
              enabled={captchaEnabled}
              onToggle={() => setCaptchaEnabled(!captchaEnabled)}
            />
          </div>

          {/* Currency */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}><Coins size={16} style={{marginRight:'8px',color:'#F59E0B'}} />Currency</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Currency name</label>
                <input value={currencyName} onChange={e => setCurrencyName(e.target.value)} className="input-field" placeholder="Coins" />
              </div>
              <div>
                <label style={labelStyle}>Currency symbol</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    value={currencySymbol}
                    onChange={e => setCurrencySymbol(e.target.value)}
                    className="input-field"
                    placeholder="🪙 or text"
                    style={{ flex: 1 }}
                  />
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0
                  }}>
                    {currencySymbol || '🪙'}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Type an emoji or short text
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>USD to currency rate</label>
                <input type="number" value={usdToCurrencyRate} onChange={e => setUsdToCurrencyRate(Number(e.target.value))} className="input-field" />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  1 USD = {usdToCurrencyRate} {currencySymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Channels */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}><Radio size={16} style={{marginRight:'8px',color:'#10B981'}} />Channels</h3>
            <ToggleRow
              label="Require channel join"
              desc="Users must join all listed channels before using the bot"
              enabled={requireChannelJoin}
              onToggle={() => setRequireChannelJoin(!requireChannelJoin)}
            />

            <div style={{
              fontSize: '12px', color: 'var(--text-muted)',
              marginTop: '8px',
              display: requireChannelJoin ? 'block' : 'none'
            }}>
              {requiredChannels.length}/{channelLimit} channels used
              {userPlan === 'free' ? ' (free plan)' : ' (pro plan)'}
            </div>

            {requireChannelJoin && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {requiredChannels.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {requiredChannels.map((ch, i) => (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{ch.title || ch.username}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ch.username} · {ch.id}</div>
                        </div>
                        <button
                          onClick={() => {
                            const updated = requiredChannels.filter((_, idx) => idx !== i)
                            setRequiredChannels(updated)
                            supabase.from('bot_settings')
                              .update({ required_channels: updated })
                              .eq('bot_id', botId)
                              .then(({ error }) => {
                                if (error) toast.error('Failed to remove channel')
                                else toast.success('Channel removed ✓')
                              })
                          }}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#FCA5A5', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Add channel username</label>
                    <input
                      value={newChannelUsername}
                      onChange={e => setNewChannelUsername(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChannel()}
                      className="input-field"
                      placeholder="@channel, t.me/channel or https://t.me/channel"
                    />
                  </div>
                  <button
                    onClick={addChannel}
                    disabled={addingChannel || !newChannelUsername.trim() || !botToken}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    {addingChannel ? 'Adding...' : '+ Add Channel'}
                  </button>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> Make sure @{botUsername} is admin in each channel before adding it.
                </div>
              </div>
            )}
          </div>

          {/* Withdrawal Settings */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}><ArrowUpFromLine size={16} style={{marginRight:'8px',color:'#8B5CF6'}} />Withdrawal Settings</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                fontSize: '12px',
                color: userPlan === 'pro' ? '#93C5FD' : '#FBBF24',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${userPlan === 'pro' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'}`,
                background: userPlan === 'pro' ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)',
              }}>
                {userPlan === 'pro'
                  ? 'Pro creators can use FaucetPay or OxaPay for automatic withdrawals.'
                  : 'Free creators can use FaucetPay only. Upgrade to Pro to unlock OxaPay payouts.'}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px',
              }}>
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>FaucetPay API Key</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Used for free-plan automatic payouts. Current payout currency: {faucetpayPayoutCurrency}.
                      </div>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: faucetpayConfigured ? '#86EFAC' : 'var(--text-muted)',
                      border: `1px solid ${faucetpayConfigured ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      background: faucetpayConfigured ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '999px',
                      padding: '5px 10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {faucetpayConfigured ? `Configured ${faucetpayMaskedKey}` : 'Not configured'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-ghost" type="button" onClick={() => openKeyDialog('faucetpay', faucetpayConfigured ? 'replace' : 'set')}>
                      {faucetpayConfigured ? 'Replace key' : 'Set key'}
                    </button>
                    {faucetpayConfigured && (
                      <button className="btn-ghost" type="button" onClick={() => openKeyDialog('faucetpay', 'remove')}>
                        Remove key
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  border: `1px solid ${userPlan === 'pro' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '12px',
                  padding: '14px',
                  opacity: userPlan === 'pro' ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>OxaPay Payout API Key</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Pro only. OxaPay payouts are sent in USDT on TRC20.
                      </div>
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: oxapayConfigured ? '#86EFAC' : 'var(--text-muted)',
                      border: `1px solid ${oxapayConfigured ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      background: oxapayConfigured ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '999px',
                      padding: '5px 10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {oxapayConfigured ? `Configured ${oxapayMaskedKey}` : 'Not configured'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={userPlan !== 'pro'}
                      onClick={() => userPlan === 'pro' && openKeyDialog('oxapay', oxapayConfigured ? 'replace' : 'set')}
                    >
                      {oxapayConfigured ? 'Replace key' : 'Set key'}
                    </button>
                    {oxapayConfigured && userPlan === 'pro' && (
                      <button className="btn-ghost" type="button" onClick={() => openKeyDialog('oxapay', 'remove')}>
                        Remove key
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Min withdrawal (USD)</label>
                  <input type="number" step="0.01" value={minWithdrawUsd} onChange={e => setMinWithdrawUsd(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label style={labelStyle}>Withdrawal fee (%)</label>
                  <input type="number" step="0.01" value={withdrawFeePercent} onChange={e => setWithdrawFeePercent(Number(e.target.value))} className="input-field" />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <label style={labelStyle}>Withdrawal mode</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setWithdrawMode('automatic')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${withdrawMode === 'automatic' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: withdrawMode === 'automatic' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                    color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, textAlign: 'center' as const
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Zap size={16} /> Automatic</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 400 }}>
                    Paid instantly via API key
                  </div>
                </button>
                <button
                  onClick={() => setWithdrawMode('manual')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${withdrawMode === 'manual' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: withdrawMode === 'manual' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                    color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, textAlign: 'center' as const
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Hand size={16} /> Manual</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 400 }}>
                    You approve each request
                  </div>
                </button>
              </div>
              {withdrawMode === 'automatic' && (
                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Automatic payout provider</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setWithdrawProvider('faucetpay')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: `1px solid ${withdrawProvider === 'faucetpay' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        background: withdrawProvider === 'faucetpay' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>FaucetPay</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {faucetpayConfigured ? `Configured for ${faucetpayPayoutCurrency}` : 'Set a FaucetPay key first'}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={userPlan !== 'pro'}
                      onClick={() => userPlan === 'pro' && setWithdrawProvider('oxapay')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        cursor: userPlan === 'pro' ? 'pointer' : 'not-allowed',
                        border: `1px solid ${withdrawProvider === 'oxapay' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        background: withdrawProvider === 'oxapay' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        opacity: userPlan === 'pro' ? 1 : 0.6,
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>OxaPay</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {userPlan === 'pro'
                          ? (oxapayConfigured ? 'Configured for USDT (TRC20)' : 'Set an OxaPay payout key first')
                          : 'Pro only'}
                      </div>
                    </button>
                  </div>
                </div>
              )}
              {withdrawMode === 'automatic' && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#60A5FA', padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Zap size={14} style={{ marginTop: '1px' }} />
                  {withdrawProvider === 'oxapay'
                    ? 'Withdrawals will be sent automatically with OxaPay in USDT on TRC20.'
                    : `Withdrawals will be sent automatically with FaucetPay in ${faucetpayPayoutCurrency}. Users can submit a FaucetPay email or a linked payout address.`}
                </div>
              )}
              {withdrawMode === 'manual' && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#FBBF24', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Hand size={14} style={{ marginTop: '1px' }} /> Users submit withdrawal requests. You approve them manually from the dashboard.
                </div>
              )}
              {withdrawMode === 'manual' && (
                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>
                    Withdrawal Secret Passphrase
                    <span style={{ color: '#EF4444', marginLeft: '4px' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={withdrawalPassphrase}
                      onChange={e => setWithdrawalPassphrase(e.target.value)}
                      className="input-field"
                      placeholder="Enter a secret passphrase"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)',
                        fontSize: '16px'
                      }}
                    >
                      {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#FBBF24', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <AlertTriangle size={13} style={{ marginTop: '2px', flexShrink: 0 }} /> 
                    <span>This passphrase is required when approving withdrawals manually. Keep it safe — it cannot be recovered if lost.</span>
                  </div>
                  {!withdrawalPassphrase && (
                    <div style={{ fontSize: '12px', color: '#FCA5A5', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <AlertTriangle size={13} style={{ marginTop: '1px' }} />
                      Passphrase is required for manual withdrawal mode
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {keyDialog && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2,6,23,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 1000,
            }}>
              <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {keyDialog.mode === 'remove'
                      ? `Remove ${keyDialog.provider === 'oxapay' ? 'OxaPay' : 'FaucetPay'} key`
                      : `${keyDialog.mode === 'replace' ? 'Replace' : 'Set'} ${keyDialog.provider === 'oxapay' ? 'OxaPay' : 'FaucetPay'} key`}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                    Stored keys stay encrypted on the server and are never shown again in the browser.
                    {keyDialog.mode !== 'set' && ' Enter your login password to continue.'}
                  </div>
                </div>

                {keyDialog.mode !== 'remove' && (
                  <div>
                    <label style={labelStyle}>API key</label>
                    <input
                      value={paymentKeyInput}
                      onChange={e => setPaymentKeyInput(e.target.value)}
                      className="input-field"
                      placeholder={keyDialog.provider === 'oxapay' ? 'Paste OxaPay payout API key' : 'Paste FaucetPay API key'}
                    />
                  </div>
                )}

                {keyDialog.mode !== 'set' && (
                  <div>
                    <label style={labelStyle}>Current login password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="input-field"
                      placeholder="Enter your password"
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost" onClick={closeKeyDialog} disabled={submittingPaymentKey}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={submitPaymentKey} disabled={submittingPaymentKey}>
                    {submittingPaymentKey
                      ? 'Please wait...'
                      : keyDialog.mode === 'remove'
                        ? 'Confirm remove'
                        : 'Save key'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIP Plan — OxaPay Deposit Config only */}
          {userPlan === 'pro' && (
            <div style={sectionCardStyle}>
              <h3 style={sectionTitle}><Zap size={16} style={{marginRight:'8px',color:'#F59E0B'}} />VIP Plan — Deposit Configuration</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                Configure OxaPay so bot users can deposit to activate investment plans. The bot will auto-generate a unique deposit address per user.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>OxaPay Merchant Key</label>
                  <input
                    type="password"
                    value={proOxapayKeyInput}
                    onChange={e => setProOxapayKeyInput(e.target.value)}
                    className="input-field"
                    placeholder={proOxapayConfigured ? '••••••••••••' : 'Paste OxaPay merchant key'}
                  />
                </div>

                <div style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Callback URL (add this in OxaPay dashboard):</div>
                  {`${process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'}/webhooks/oxapay-pro/${botId}`}
                </div>
                <button
                  type="button"
                  disabled={savingProOxapay || !proOxapayKeyInput.trim()}
                  className="btn-ghost"
                  onClick={async () => {
                    setSavingProOxapay(true)
                    try {
                      const updates: any = { pro_oxapay_configured: true }
                      if (proOxapayKeyInput.trim()) updates.pro_oxapay_merchant_key = proOxapayKeyInput
                      const { error } = await supabase.from('bot_settings').update(updates).eq('bot_id', botId)
                      if (error) throw error
                      setProOxapayConfigured(true)
                      setProOxapayKeyInput('')
                      setProOxapaySecretInput('')
                      toast.success('OxaPay keys saved ✓')
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to save')
                    }
                    setSavingProOxapay(false)
                  }}
                >
                  {savingProOxapay ? 'Saving...' : proOxapayConfigured ? 'Update OxaPay Keys' : 'Save OxaPay Keys'}
                </button>
                {proOxapayConfigured && (
                  <div style={{ fontSize: '12px', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✅ OxaPay configured. Users can now deposit to activate investment plans.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save */}
          <div>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
