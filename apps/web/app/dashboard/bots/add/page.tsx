'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Loader2, Plus, Bot as BotIcon, ExternalLink } from 'lucide-react'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BotIcon size={22} color="var(--accent)" /> Add Bot
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>
          Connect your Telegram bot token to 1-TouchBot.
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontFamily: 'Inter, sans-serif' }}>
          <AlertCircle size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {/* Token Input Card */}
      <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BotIcon size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Bot Token</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              Get your token from{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                @BotFather <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Paste your BotFather token
          </label>
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
                {tokenStatus === 'success' && <CheckCircle size={16} style={{ color: 'var(--accent)' }} />}
                {tokenStatus === 'error' && <AlertCircle size={16} style={{ color: 'var(--red)' }} />}
              </span>
            )}
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', minHeight: '18px', fontFamily: 'Inter, sans-serif' }}>
            {tokenStatus === 'loading' && <span style={{ color: 'var(--text-secondary)' }}>Verifying token...</span>}
            {tokenStatus === 'success' && <span style={{ color: 'var(--accent)' }}>Token verified ✓</span>}
            {tokenStatus === 'error' && <span style={{ color: 'var(--red)' }}>Invalid or unrecognized token</span>}
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn-primary"
            disabled={setupLoading || tokenStatus !== 'success' || !token}
            onClick={completeSetup}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}
          >
            {setupLoading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Creating your bot...
              </>
            ) : (
              <>
                <Plus size={16} />
                Complete Setup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help card */}
      <div className="glass" style={{ padding: '18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          How to get your token
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            'Open Telegram and search for @BotFather',
            'Send /newbot and follow the instructions',
            'Copy the token provided by BotFather',
            'Paste it above and click Complete Setup',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif" }}>
                {i + 1}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
