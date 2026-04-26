"use client"

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Info } from 'lucide-react'
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

  const [webhookStatus, setWebhookStatus] = useState(false)
  const [checkingWebhook, setCheckingWebhook] = useState(false)
  const [fixingWebhook, setFixingWebhook] = useState(false)

  const [fetchingChannel, setFetchingChannel] = useState(false)
  const [verifyingAdmin, setVerifyingAdmin] = useState(false)
  const [adminVerified, setAdminVerified] = useState(false)
  const [adminVerifyResult, setAdminVerifyResult] = useState('')

  // Welcome
  const [welcomeEnabled, setWelcomeEnabled] = useState(false)
  const [welcomeMessage, setWelcomeMessage] = useState('')

  // Security
  const [captchaEnabled, setCaptchaEnabled] = useState(true)

  // Channel
  const [requireChannelJoin, setRequireChannelJoin] = useState(false)
  const [requiredChannelId, setRequiredChannelId] = useState('')
  const [requiredChannelUsername, setRequiredChannelUsername] = useState('')

  // Withdraw
  const [manualWithdraw, setManualWithdraw] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: botRow, error: botErr } = await supabase
          .from('bots')
          .select('bot_token, webhook_set')
          .eq('id', botId)
          .single()
        if (botErr) throw botErr

        const { data, error: settingsErr } = await supabase
          .from('bot_settings')
          .select('*')
          .eq('bot_id', botId)
          .single()
        if (settingsErr) throw settingsErr
        if (cancelled) return

        setBotToken(botRow?.bot_token || '')
        setWebhookStatus(botRow?.webhook_set || false)

        const msg = data.welcome_message || ''
        setWelcomeMessage(msg)
        setWelcomeEnabled(!!msg)

        setCaptchaEnabled(data.captcha_enabled ?? true)
        setRequireChannelJoin(Boolean(data.require_channel_join))
        setRequiredChannelId(data.required_channel_id || '')
        setRequiredChannelUsername(data.required_channel_username || '')
        setManualWithdraw(Boolean(data.withdraw_enabled))
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

  async function fetchChannelId(username: string) {
    setFetchingChannel(true)
    try {
      const clean = username.startsWith('@') ? username : '@' + username
      const res = await fetch(`${BOT_ENGINE_URL}/api/bots/channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, botToken })
      })
      const data = await res.json()
      if (data.channelId) {
        setRequiredChannelId(data.channelId)
        toast.success('Channel ID found: ' + data.channelId)
      } else {
        toast.error('Could not find channel. Make sure username is correct and the bot is admin.')
      }
    } catch {
      toast.error('Failed to fetch channel info')
    }
    setFetchingChannel(false)
  }

  async function verifyChannelAdmin() {
    setVerifyingAdmin(true)
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/bots/verify-channel-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: requiredChannelId, botToken })
      })
      const data = await res.json()
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
    try {
      const { error: upErr } = await supabase
        .from('bot_settings')
        .update({
          welcome_message: welcomeEnabled ? welcomeMessage : '',
          captcha_enabled: captchaEnabled,
          require_channel_join: requireChannelJoin,
          required_channel_id: requireChannelJoin ? requiredChannelId || null : null,
          required_channel_username: requireChannelJoin ? requiredChannelUsername || null : null,
          withdraw_enabled: manualWithdraw
        })
        .eq('bot_id', botId)
      if (upErr) throw upErr
      toast.success('Settings saved!')
    } catch (e: any) {
      const message = e?.message || 'Failed to save'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const canSave = !requireChannelJoin || adminVerified

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
              <span className={`pulse-dot ${webhookStatus ? 'green' : 'red'}`} />
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
            <h3 style={sectionTitle}>Welcome message</h3>
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
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '88px' }}
                  placeholder="Welcome! Use the buttons below to get started."
                />
              </div>
            )}
          </div>

          {/* Security */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}>Security</h3>
            <ToggleRow
              label="Captcha verification"
              desc="New users must solve a math challenge before accessing the bot"
              enabled={captchaEnabled}
              onToggle={() => setCaptchaEnabled(!captchaEnabled)}
            />
          </div>

          {/* Channels */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}>Channels</h3>
            <ToggleRow
              label="Require channel join"
              desc="Force users to join a channel before using the bot"
              enabled={requireChannelJoin}
              onToggle={() => { setRequireChannelJoin(!requireChannelJoin); setAdminVerified(false); setAdminVerifyResult('') }}
            />
            {requireChannelJoin && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Channel username</label>
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

                <div>
                  <label style={labelStyle}>Channel ID (auto-filled)</label>
                  <input
                    value={requiredChannelId}
                    readOnly
                    className="input-field"
                    style={{ opacity: 0.8 }}
                    placeholder="-1001234567890"
                  />
                </div>

                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '14px 16px' }}>
                  <p style={{ fontWeight: 500, color: '#FBBF24', fontSize: '13px', margin: '0 0 8px 0' }}>
                    Add @twinbot_twinbot as channel administrator
                  </p>
                  <ol style={{ color: '#FDE68A', fontSize: '12px', lineHeight: '2', paddingLeft: '16px', margin: 0 }}>
                    <li>Open your Telegram channel → Administrators</li>
                    <li>Add Administrator → search @twinbot_twinbot</li>
                    <li>Enable "Read Messages" permission → Save</li>
                  </ol>
                </div>

                <button
                  onClick={verifyChannelAdmin}
                  disabled={verifyingAdmin || !requiredChannelId}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  {verifyingAdmin ? 'Verifying...' : adminVerified ? '✓ Verified — Save to activate' : 'Verify @twinbot_twinbot is admin'}
                </button>

                {adminVerifyResult && (
                  <div style={{
                    background: adminVerified ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${adminVerified ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    borderRadius: '8px', padding: '10px 12px',
                    fontSize: '12px', color: adminVerified ? '#10B981' : '#FCA5A5'
                  }}>
                    {adminVerifyResult}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Withdrawals */}
          <div style={sectionCardStyle}>
            <h3 style={sectionTitle}>Withdrawals</h3>
            <ToggleRow
              label="Manual withdrawal approval"
              desc="You approve each withdrawal request manually from the dashboard"
              enabled={manualWithdraw}
              onToggle={() => setManualWithdraw(!manualWithdraw)}
            />
            {manualWithdraw && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Info size={16} style={{ marginTop: '1px', flexShrink: 0, color: '#818cf8' }} />
                <span>Users will submit withdrawal requests which you approve manually</span>
              </div>
            )}
          </div>

          {/* Save */}
          <div>
            <button
              onClick={save}
              disabled={saving || !canSave}
              className="btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            {requireChannelJoin && !adminVerified && (
              <div style={{ fontSize: '12px', color: '#FCA5A5', marginTop: '8px' }}>
                Verify @twinbot_twinbot as admin before saving channel settings
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
