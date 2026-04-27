'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Loader2, Plus, Bot as BotIcon } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AddBotPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [token, setToken] = useState('')
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [setupLoading, setSetupLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!token.trim()) {
      setTokenStatus('idle')
      return
    }
    setTokenStatus('loading')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://1-touchbot-engine.onrender.com'
        const resp = await axios.post(`${BOT_ENGINE_URL}/api/bots/validate`, { token })
        setTokenStatus(resp.data?.valid ? 'success' : 'error')
      } catch {
        setTokenStatus('error')
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [token])

  async function completeSetup() {
    setSetupLoading(true)
    setError(null)
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
        welcomeMessage: 'Welcome! Use the buttons below to get started.',
        currencyName: 'Coins',
        currencySymbol: '🪙',
        usdRate: 1000,
        category: 'general'
      })
      console.log('Register response:', resp.data)
      const botId = resp.data?.bot?.id ?? resp.data?.id
      toast.success('Bot created successfully!')
      router.push(`/dashboard/bots/${resp.data.bot?.id || resp.data.id}/settings`)
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Registration failed'
      toast.error(message)
      setError(message)
    } finally {
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

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <BotIcon size={18} />
          Bot token
        </div>

        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Paste your BotFather token</label>
          <div style={{ position: 'relative' }}>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="input-field"
              placeholder="123456:ABCDEF..."
              style={{ paddingRight: '36px' }}
            />
            {tokenStatus !== 'idle' && (
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                {tokenStatus === 'loading' && <Loader2 size={16} style={{ color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />}
                {tokenStatus === 'success' && <CheckCircle size={16} style={{ color: '#22c55e' }} />}
                {tokenStatus === 'error' && <AlertCircle size={16} style={{ color: '#ef4444' }} />}
              </span>
            )}
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', minHeight: '18px' }}>
            {tokenStatus === 'loading' && <span style={{ color: 'var(--text-secondary)' }}>Verifying...</span>}
            {tokenStatus === 'success' && <span style={{ color: '#22c55e' }}>Token verified ✓</span>}
            {tokenStatus === 'error' && <span style={{ color: '#ef4444' }}>Invalid token</span>}
          </div>
        </div>

        <div style={{ paddingTop: '4px' }}>
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
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
