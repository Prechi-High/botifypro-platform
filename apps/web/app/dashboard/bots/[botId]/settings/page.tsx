"use client"

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Settings as SettingsIcon, Copy, Eye, EyeOff } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function BotSettingsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://1-touchbot-engine.onrender.com'
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingChannel, setFetchingChannel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [botToken, setBotToken] = useState<string>('')
  
  // Webhook states
  const [webhookStatus, setWebhookStatus] = useState(false)
  const [checkingWebhook, setCheckingWebhook] = useState(false)
  const [fixingWebhook, setFixingWebhook] = useState(false)
  
  // Channel verification states
  const [verifyingAdmin, setVerifyingAdmin] = useState(false)
  const [adminVerified, setAdminVerified] = useState(false)
  const [adminVerifyResult, setAdminVerifyResult] = useState('')
  
  // Settings states
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [currencyName, setCurrencyName] = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('')
  const [usdToCurrencyRate, setUsdToCurrencyRate] = useState<number>(1000)
  const [minDepositUsd, setMinDepositUsd] = useState<number>(1)
  const [minWithdrawUsd, setMinWithdrawUsd] = useState<number>(0.5)
  const [withdrawFeePercent, setWithdrawFeePercent] = useState<number>(0)
  const [oxapayMerchantKey, setOxapayMerchantKey] = useState<string>('')
  const [oxapaySecretKey, setOxapaySecretKey] = useState<string>('')
  const [faucetpayApiKey, setFaucetpayApiKey] = useState<string>('')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [requireChannelJoin, setRequireChannelJoin] = useState<boolean>(false)
  const [requiredChannelId, setRequiredChannelId] = useState<string>('')
  const [requiredChannelUsername, setRequiredChannelUsername] = useState<string>('')
  
  // Payment feature toggles
  const [balanceEnabled, setBalanceEnabled] = useState(false)
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [withdrawEnabled, setWithdrawEnabled] = useState(false)
  const [referralEnabled, setReferralEnabled] = useState(false)
  const [referralRewardAmount, setReferralRewardAmount] = useState<number>(100)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Load bot data
        const { data: botRow, error: botTokenErr } = await supabase
          .from('bots')
          .select('bot_token, webhook_set')
          .eq('id', botId)
          .single()
        if (botTokenErr) throw botTokenErr

        // Load settings
        const { data, error: botErr } = await supabase
          .from('bot_settings')
          .select('*')
          .eq('bot_id', botId)
          .single()
        if (botErr) throw botErr
        if (cancelled) return
        
        setBotToken(botRow?.bot_token || '')
        setWebhookStatus(botRow?.webhook_set || false)
        setWelcomeMessage(data.welcome_message)
        setCurrencyName(data.currency_name)
        setCurrencySymbol(data.currency_symbol)
        setUsdToCurrencyRate(Number(data.usd_to_currency_rate))
        setMinDepositUsd(Number(data.min_deposit_usd))
        setMinWithdrawUsd(Number(data.min_withdraw_usd))
        setWithdrawFeePercent(Number(data.withdraw_fee_percent))
        setOxapayMerchantKey(data.oxapay_merchant_key || '')
        setOxapaySecretKey(data.oxapay_secret_key || '')
        setFaucetpayApiKey(data.faucetpay_api_key || '')
        setRequireChannelJoin(Boolean(data.require_channel_join))
        setRequiredChannelId(data.required_channel_id || '')
        setRequiredChannelUsername(data.required_channel_username || '')
        
        // Payment toggles
        setBalanceEnabled(Boolean(data.balance_enabled))
        setDepositEnabled(Boolean(data.deposit_enabled))
        setWithdrawEnabled(Boolean(data.withdraw_enabled))
        setReferralEnabled(Boolean(data.referral_enabled))
        setReferralRewardAmount(Number(data.referral_reward_amount) || 100)
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message || 'Failed to load settings'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    load()
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
        toast.error('Could not find channel. Make sure username is correct and our platform bot is admin there.')
      }
    } catch {
      toast.error('Failed to fetch channel info')
    }
    setFetchingChannel(false)
  }

  async function checkWebhookStatus() {
    setCheckingWebhook(true)
    try {
      const response = await fetch(`${BOT_ENGINE_URL}/api/bots/${botId}/webhook-status`)
      const data = await response.json()
      if (data.webhookSet) {
        toast.success(`Webhook is active: ${data.url}`)
        setWebhookStatus(true)
      } else {
        toast.error(`Webhook not set. Current URL: ${data.url || 'none'}`)
        setWebhookStatus(false)
      }
    } catch (err: any) {
      toast.error('Failed to check webhook status: ' + err.message)
    }
    setCheckingWebhook(false)
  }

  async function fixWebhook() {
    setFixingWebhook(true)
    try {
      const response = await fetch(`${BOT_ENGINE_URL}/api/bots/register-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId })
      })
      const data = await response.json()
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

  async function verifyChannelAdmin() {
    setVerifyingAdmin(true)
    try {
      const response = await fetch(`${BOT_ENGINE_URL}/api/bots/verify-channel-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: requiredChannelId, botToken })
      })
      const data = await response.json()
      if (data.isAdmin) {
        setAdminVerified(true)
        setAdminVerifyResult('@twinbot_twinbot is admin ✓')
        toast.success('Verified! Channel requirement can now be saved.')
      } else {
        setAdminVerified(false)
        setAdminVerifyResult(data.message || '@twinbot_twinbot is not admin yet')
        toast.error('Please add @twinbot_twinbot as admin first')
      }
    } catch (err: any) {
      toast.error('Verification failed: ' + err.message)
    }
    setVerifyingAdmin(false)
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
          oxapay_secret_key: oxapaySecretKey || null,
          faucetpay_api_key: faucetpayApiKey || null,
          require_channel_join: requireChannelJoin,
          required_channel_id: requiredChannelId || null,
          required_channel_username: requiredChannelUsername || null,
          balance_enabled: balanceEnabled,
          deposit_enabled: depositEnabled,
          withdraw_enabled: withdrawEnabled,
          referral_enabled: referralEnabled,
          referral_reward_amount: referralRewardAmount
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

  const canSaveChannel = !requireChannelJoin || (requireChannelJoin && adminVerified)
  const callbackUrl = `${BOT_ENGINE_URL}/webhooks/oxapay`
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    marginBottom: '6px'
  }
  const sectionCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px'
  }

  async function copyCallbackUrl() {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      toast.success('Callback URL copied')
    } catch {
      toast.error('Failed to copy callback URL')
    }
  }

  return (
    <div style={{ padding: '1.5rem', background: 'var(--bg-base)', minHeight: '100vh' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Bot settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Configure behavior, currency, and payments.{' '}
          <Link 
            href={`/dashboard/bots/${botId}/commands`} 
            style={{ color: 'var(--blue-primary)', textDecoration: 'none', fontWeight: 500 }}
          >
            Custom Commands
          </Link>
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          fontSize: '0.875rem',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#FCA5A5',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '1rem'
        }}>
          <AlertCircle size={18} style={{ marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          fontSize: '0.875rem',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          color: '#10B981',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '1rem'
        }}>
          <CheckCircle size={18} style={{ marginTop: '2px' }} />
          <div>{success}</div>
        </div>
      )}

      <div style={sectionCardStyle}>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: '1rem'
        }}>
          <SettingsIcon size={18} />
          Settings
        </div>

        {loading ? (
          <div className="skeleton" style={{ width: '100%', height: '120px' }} />
        ) : (
          <>
            <div style={{
              background: webhookStatus ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${webhookStatus ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`pulse-dot ${webhookStatus ? 'green' : 'red'}`} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: webhookStatus ? '#10B981' : '#FCA5A5'
                }}>
                  {webhookStatus ? 'Webhook Active — Bot is receiving messages' : 'Webhook Not Set — Bot cannot receive messages'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={checkWebhookStatus}
                  disabled={checkingWebhook}
                  className="btn-ghost"
                >
                  {checkingWebhook ? 'Checking...' : 'Check Status'}
                </button>
                <button
                  onClick={fixWebhook}
                  disabled={fixingWebhook}
                  className="btn-ghost"
                >
                  {fixingWebhook ? 'Fixing...' : 'Fix Webhook'}
                </button>
              </div>
            </div>

            <div style={{ ...sectionCardStyle, marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '12px' }}>⚙️ General</h3>
              <label style={labelStyle}>
                Welcome message
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="input-field"
                style={{ minHeight: '96px' }}
              />
            </div>

            <div style={{ ...sectionCardStyle, marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '12px' }}>💱 Currency</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Currency name
                </label>
                <input
                  value={currencyName}
                  onChange={(e) => setCurrencyName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Currency symbol
                </label>
                <input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  USD to currency rate
                </label>
                <input
                  value={usdToCurrencyRate}
                  onChange={(e) => setUsdToCurrencyRate(Number(e.target.value))}
                  type="number"
                  className="input-field"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Min deposit (USD)
                </label>
                <input
                  value={minDepositUsd}
                  onChange={(e) => setMinDepositUsd(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="input-field"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Min withdraw (USD)
                </label>
                <input
                  value={minWithdrawUsd}
                  onChange={(e) => setMinWithdrawUsd(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="input-field"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Withdraw fee (%)
                </label>
                <input
                  value={withdrawFeePercent}
                  onChange={(e) => setWithdrawFeePercent(Number(e.target.value))}
                  type="number"
                  step="0.01"
                  className="input-field"
                />
              </div>
            </div>
            </div>

            <div style={{ ...sectionCardStyle, marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '12px' }}>💳 Payments</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>OxaPay Merchant Key</label>
                  <input value={oxapayMerchantKey} onChange={(e) => setOxapayMerchantKey(e.target.value)} className="input-field" placeholder="Optional" />
                </div>
                <div>
                  <label style={labelStyle}>OxaPay Secret Key</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={oxapaySecretKey}
                      onChange={(e) => setOxapaySecretKey(e.target.value)}
                      type={showSecretKey ? 'text' : 'password'}
                      className="input-field"
                      style={{ paddingRight: '42px' }}
                      placeholder="For webhook verification"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Callback URL — set this in your OxaPay dashboard</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={callbackUrl} readOnly className="input-field" />
                    <button type="button" onClick={copyCallbackUrl} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>FaucetPay API key</label>
                  <input value={faucetpayApiKey} onChange={(e) => setFaucetpayApiKey(e.target.value)} className="input-field" placeholder="Optional" />
                </div>
              </div>
            </div>

            <div style={{ ...sectionCardStyle, marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '12px' }}>🔘 Features</h3>
              {[
                {
                  label: 'Balance Command (/balance)',
                  desc: 'Users can check their coin balance',
                  enabled: balanceEnabled,
                  set: setBalanceEnabled,
                  disabled: false
                },
                {
                  label: 'Deposit Command (/deposit)',
                  desc: 'Users can deposit funds via crypto',
                  enabled: depositEnabled,
                  set: setDepositEnabled,
                  disabled: false
                },
                {
                  label: 'Withdrawal Command (/withdraw)',
                  desc: 'Users can withdraw their balance',
                  enabled: withdrawEnabled,
                  set: setWithdrawEnabled,
                  disabled: !depositEnabled
                },
                {
                  label: 'Referral System (/referral)',
                  desc: 'Users can earn coins for inviting others',
                  enabled: referralEnabled,
                  set: setReferralEnabled,
                  disabled: false
                }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <div
                    className={`toggle-track ${item.enabled ? 'on' : 'off'}`}
                    onClick={() => !item.disabled && item.set(!item.enabled)}
                    style={{ opacity: item.disabled ? 0.5 : 1, pointerEvents: item.disabled ? 'none' : 'auto' }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                </div>
              ))}
              {referralEnabled && (
                <div style={{
                  marginTop: '12px',
                  marginLeft: '56px',
                  padding: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px'
                }}>
                  <label style={{
                    display: 'block', fontSize: '13px',
                    fontWeight: '500', color: 'var(--text-secondary)',
                    marginBottom: '6px'
                  }}>
                    Reward per referral
                  </label>
                  <input
                    type="number"
                    value={referralRewardAmount}
                    onChange={e => setReferralRewardAmount(Number(e.target.value))}
                    className="input-field"
                    style={{ maxWidth: '200px' }}
                  />
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '6px'
                  }}>
                    Coins credited to referrer when someone joins via their link
                  </p>
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                Only works if OxaPay or FaucetPay key is configured above
              </div>
              {withdrawEnabled && !depositEnabled && (
                <div style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.28)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#FBBF24',
                  marginTop: '8px'
                }}>
                  ⚠️ Withdrawal requires deposit to also be enabled
                </div>
              )}
              
              {withdrawEnabled && !oxapayMerchantKey && !faucetpayApiKey && (
                <div style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.28)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#FBBF24',
                  marginTop: '8px'
                }}>
                  ⚠️ Add an OxaPay or FaucetPay API key above before enabling withdrawals
                </div>
              )}
            </div>

            <div style={{ ...sectionCardStyle, marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '12px' }}>📢 Channel</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>Require channel join</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Force users to join a channel before using bot.</div>
                </div>
                <div className={`toggle-track ${requireChannelJoin ? 'on' : 'off'}`} onClick={() => setRequireChannelJoin(!requireChannelJoin)}>
                  <div className="toggle-thumb" />
                </div>
              </div>

              {requireChannelJoin && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>
                        Channel Username
                      </label>
                      <input
                        value={requiredChannelUsername}
                        onChange={(e) => setRequiredChannelUsername(e.target.value)}
                        className="input-field"
                        placeholder="@mychannel"
                      />
                    </div>
                    <button
                      onClick={() => fetchChannelId(requiredChannelUsername)}
                      disabled={fetchingChannel || !requiredChannelUsername || !botToken}
                      className="btn-ghost"
                    >
                      {fetchingChannel ? 'Fetching...' : 'Get ID'}
                    </button>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>
                      Channel ID (auto-filled)
                    </label>
                    <input
                      value={requiredChannelId}
                      onChange={(e) => setRequiredChannelId(e.target.value)}
                      readOnly
                      className="input-field"
                      style={{ opacity: 0.8 }}
                      placeholder="-1001234567890"
                    />
                  </div>

                  {/* Step Indicators */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: requiredChannelUsername && requiredChannelId ? '#16a34a' : '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white'
                      }}>
                        {requiredChannelUsername && requiredChannelId ? '✓' : '1'}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                        Enter channel details
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white'
                      }}>
                        2
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                        Add @twinbot_twinbot as admin
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginTop: '12px'
                    }}>
                      <p style={{ fontWeight: '500', color: '#FBBF24', fontSize: '13px', marginBottom: '10px', margin: 0 }}>
                        Add @twinbot_twinbot as channel administrator
                      </p>
                      <ol style={{ color: '#FDE68A', fontSize: '12px', lineHeight: '2', paddingLeft: '16px', margin: 0 }}>
                        <li>Open your Telegram channel</li>
                        <li>Tap channel name at the top</li>
                        <li>Tap "Administrators"</li>
                        <li>Tap "Add Administrator"</li>
                        <li>Search for: <strong>@twinbot_twinbot</strong></li>
                        <li>Enable "Read Messages" permission at minimum</li>
                        <li>Tap Save</li>
                      </ol>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: adminVerified ? '#16a34a' : '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white'
                      }}>
                        {adminVerified ? '✓' : '3'}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                        Verify admin status
                      </span>
                    </div>

                    <button
                      onClick={verifyChannelAdmin}
                      disabled={verifyingAdmin || !requiredChannelId}
                      className="btn-primary"
                      style={{ width: '100%', padding: '10px', marginBottom: '12px' }}
                    >
                      {verifyingAdmin ? 'Verifying...' : adminVerified ? '✓ Verified — Save to activate' : 'Verify @twinbot_twinbot is Admin'}
                    </button>

                    {adminVerifyResult && (
                      <div style={{
                        background: adminVerified ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${adminVerified ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: adminVerified ? '#10B981' : '#FCA5A5'
                      }}>
                        {adminVerified ? '✓ ' : ''}{adminVerifyResult}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ paddingTop: '8px' }}>
              <button
                onClick={save}
                disabled={saving || !canSaveChannel}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
                {!saving && success && <CheckCircle size={16} />}
              </button>
              {requireChannelJoin && !adminVerified && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#FCA5A5',
                  marginTop: '8px'
                }}>
                  ⚠️ Verify @twinbot_twinbot as admin before saving channel settings
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
