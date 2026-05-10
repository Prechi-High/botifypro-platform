'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Copy, CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newBalance: number) => void
  title?: string
  purpose?: 'advertiser' | 'upgrade'
}

const NETWORKS = [
  {
    id: 'TRC20',
    label: 'TRC20',
    chain: 'TRON',
    chainColor: '#ff6b6b',
    chainBg: 'rgba(255,0,0,0.1)',
    chainBorder: 'rgba(255,0,0,0.2)',
    tokenColor: 'var(--accent)',
    tokenBg: 'rgba(57,255,20,0.08)',
    tokenBorder: 'rgba(57,255,20,0.2)',
    fee: 'Very Low',
    warning: "Send USDT (TRC20) only. Do not send from exchanges that don't support TRC20.",
  },
  {
    id: 'BEP20',
    label: 'BEP20',
    chain: 'BNB Chain',
    chainColor: '#F0B90B',
    chainBg: 'rgba(240,185,11,0.1)',
    chainBorder: 'rgba(240,185,11,0.25)',
    tokenColor: 'var(--accent)',
    tokenBg: 'rgba(57,255,20,0.08)',
    tokenBorder: 'rgba(57,255,20,0.2)',
    fee: 'Very Low',
    warning: 'Send USDT (BEP20) only. Ensure your wallet supports BNB Chain (BSC).',
  },
  {
    id: 'ERC20',
    label: 'ERC20',
    chain: 'Ethereum',
    chainColor: '#627EEA',
    chainBg: 'rgba(98,126,234,0.1)',
    chainBorder: 'rgba(98,126,234,0.25)',
    tokenColor: 'var(--accent)',
    tokenBg: 'rgba(57,255,20,0.08)',
    tokenBorder: 'rgba(57,255,20,0.2)',
    fee: 'Higher',
    warning: 'Send USDT (ERC20) only. Ethereum gas fees apply — ensure your wallet has enough ETH for gas.',
  },
  {
    id: 'TON',
    label: 'TON',
    chain: 'TON',
    chainColor: '#0098EA',
    chainBg: 'rgba(0,152,234,0.1)',
    chainBorder: 'rgba(0,152,234,0.25)',
    tokenColor: 'var(--accent)',
    tokenBg: 'rgba(57,255,20,0.08)',
    tokenBorder: 'rgba(57,255,20,0.2)',
    fee: 'Very Low',
    warning: 'Send USDT on TON only. Compatible with TON wallets (e.g. Tonkeeper, @wallet on Telegram).',
  },
] as const

type NetworkId = typeof NETWORKS[number]['id']

export default function DepositModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Deposit USDT',
  purpose = 'advertiser',
}: DepositModalProps) {
  const supabase = useMemo(() => createClient(), [])
  const botEngineUrl = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('TRC20')
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [balance, setBalance] = useState(0)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadAddress(selectedNetwork)
    }
  }, [isOpen])

  async function loadAddress(network: NetworkId) {
    setLoading(true)
    setError('')
    setAddress('')
    setQrCode('')

    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      const userEmail = auth.user?.email || ''
      if (!uid) throw new Error('Not authenticated')

      setUserId(uid)

      const { data: user } = await supabase
        .from('users')
        .select('advertiser_balance')
        .eq('id', uid)
        .single()

      setBalance(Number(user?.advertiser_balance || 0))

      const res = await fetch(`${botEngineUrl}/api/payments/get-deposit-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, email: userEmail, network, purpose }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load deposit address')
      }

      setAddress(data.address || '')
      setQrCode(data.qrCode || '')
    } catch (err: any) {
      console.error('Failed to load deposit address', err)
      setError(err?.message || 'Failed to load deposit address. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleNetworkChange(network: NetworkId) {
    if (network === selectedNetwork) return
    setSelectedNetwork(network)
    loadAddress(network)
  }

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function checkPayment() {
    if (!userId) return

    setCheckingPayment(true)
    try {
      const previousBalance = balance
      const { data: user } = await supabase
        .from('users')
        .select('advertiser_balance')
        .eq('id', userId)
        .single()

      const newBalance = Number(user?.advertiser_balance || 0)
      setBalance(newBalance)

      if (newBalance > previousBalance) {
        onSuccess?.(newBalance)
      }
    } catch {
      setError('Could not refresh balance right now.')
    } finally {
      setCheckingPayment(false)
    }
  }

  if (!isOpen) return null

  const activeNet = NETWORKS.find(n => n.id === selectedNetwork)!

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '440px',
          overflow: 'hidden',
        }}
      >
        {/* Green top bar */}
        <div style={{ height: '2px', background: 'var(--accent-gradient)' }} />

        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Network selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif" }}>
              Select Network
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {NETWORKS.map(net => {
                const isActive = selectedNetwork === net.id
                return (
                  <button
                    key={net.id}
                    onClick={() => handleNetworkChange(net.id)}
                    disabled={loading}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${isActive ? net.chainColor : 'var(--border)'}`,
                      background: isActive ? net.chainBg : 'var(--bg-elevated)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'var(--transition)',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isActive ? net.chainColor : 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {net.id}
                    </span>
                    <span style={{ fontSize: '10px', color: isActive ? net.chainColor : 'var(--text-muted)', opacity: 0.85, fontFamily: 'Inter, sans-serif' }}>
                      {net.chain}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
              Generating {selectedNetwork} deposit address...
            </div>
          ) : address ? (
            <>
              {/* Network badges */}
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: activeNet.chainBg, border: `1px solid ${activeNet.chainBorder}`, color: activeNet.chainColor, padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {activeNet.chain}
                </span>
                <span style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                  USDT {activeNet.label}
                </span>
              </div>

              {qrCode && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <img src={qrCode} alt="Deposit QR code" style={{ width: '140px', height: '140px', borderRadius: 'var(--radius-md)', border: '4px solid white' }} />
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Your Deposit Address
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <code style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {address}
                  </code>
                  <button
                    onClick={copyAddress}
                    style={{
                      background: copied ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${copied ? 'rgba(57,255,20,0.3)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      color: copied ? 'var(--accent)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#FBBF24', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>This is a <b>temporary address</b> — valid for <b>60 minutes</b>. {activeNet.warning}</span>
              </div>

              <button
                onClick={checkPayment}
                disabled={checkingPayment}
                className="btn-primary"
                style={{ width: '100%', padding: '11px', borderRadius: 'var(--radius-md)', fontSize: '14px' }}
              >
                {checkingPayment ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    I&apos;ve Sent Payment
                  </>
                )}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px', fontFamily: 'Inter, sans-serif' }}>
              {error || 'Failed to load deposit address. Try again.'}
              {error && (
                <button
                  onClick={() => loadAddress(selectedNetwork)}
                  className="btn-ghost"
                  style={{ display: 'block', margin: '12px auto 0', padding: '8px 16px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
