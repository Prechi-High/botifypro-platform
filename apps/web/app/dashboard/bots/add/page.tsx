'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Plus, Bot as BotIcon } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
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
      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://1-touchbot-engine.onrender.com'
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

      const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://1-touchbot-engine.onrender.com'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Add bot</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Connect your Telegram bot token to 1-TouchBot.</p>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', borderRadius: '10px', padding: '12px' }}>
          <AlertCircle size={18} style={{ marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <BotIcon size={18} />
          Bot details
        </div>

        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Bot token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input-field"
            placeholder="123456:ABCDEF..."
          />
          <div style={{ marginTop: '8px' }}>
            <button type="button" className="btn-ghost" disabled={!token || setupLoading || tokenStatus === 'loading'} onClick={validateToken} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} />
              {tokenStatus === 'loading' ? 'Validating token...' : 'Verify Token'}
            </button>

            {tokenStatus !== 'idle' && (
              <div style={{ marginTop: '12px' }}>
                {tokenStatus === 'loading' && <StatusBadge status="loading" text="Checking token..." />}
                {tokenStatus === 'success' && <StatusBadge status="success" text="Token verified ✓" />}
                {tokenStatus === 'error' && <StatusBadge status="error" text="Invalid token" />}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Currency name</label>
            <input
              value={currencyName}
              onChange={(e) => setCurrencyName(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Currency symbol</label>
            <input
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>USD to currency rate</label>
            <input
              value={usdRate}
              onChange={(e) => setUsdRate(Number(e.target.value))}
              type="number"
              className="input-field"
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              placeholder="general"
            />
          </div>
        </div>

        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Welcome message</label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="input-field"
            style={{ minHeight: '96px' }}
          />
        </div>

        <div style={{ paddingTop: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={setupLoading || tokenStatus !== 'success' || !token}
            onClick={completeSetup}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} />
            {setupLoading ? 'Creating your bot...' : 'Complete Setup'}
          </button>
        </div>

        {setupStep > 0 && (
          <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              {setupStep === 1 && <LoadingSpinner size={16} color="#2563eb" />}
              {setupStep >= 2 && <CheckCircle size={16} color="#16a34a" />}
              Step 1: Saving bot settings...
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              {setupStep === 2 && <LoadingSpinner size={16} color="#2563eb" />}
              {setupStep >= 3 && <CheckCircle size={16} color="#16a34a" />}
              Step 2: Registering webhook with Telegram...
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              {setupStep >= 3 && <CheckCircle size={16} color="#16a34a" />}
              Step 3: Bot is ready!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

