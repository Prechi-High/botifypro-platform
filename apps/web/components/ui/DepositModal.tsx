'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Copy, CheckCircle, Loader2, RefreshCw } from 'lucide-react'

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
    tokenColor: '#10B981',
    tokenBg: 'rgba(16,185,129,0.1)',
    tokenBorder: 'rgba(16,185,129,0.2)',
    fee: 'Very Low',
    warning: 'Send USDT (TRC20) only. Do not send from exchanges that don\'t support TRC20.',
  },
  {
    id: 'BEP20',
    label: 'BEP20',
    chain: 'BNB Chain',
    chainColor: '#F0B90B',
    chainBg: 'rgba(240,185,11,0.1)',
    chainBorder: 'rgba(240,185,11,0.25)',
    tokenColor: '#10B981',
    tokenBg: 'rgba(16,185,129,0.1)',
    tokenBorder: 'rgba(16,185,129,0.2)',
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
    tokenColor: '#10B981',
    tokenBg: 'rgba(16,185,129,0.1)',
    tokenBorder: 'rgba(16,185,129,0.2)',
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
    tokenColor: '#10B981',
    tokenBg: 'rgba(16,185,129,0.1)',
    tokenBorder: 'rgba(16,185,129,0.2)',
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
        background: 'rgba(0,0,0,0.75)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Network selector */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '10px',
            }}
          >
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
                    borderRadius: '10px',
                    border: `1.5px solid ${isActive ? net.chainColor : 'var(--border)'}`,
                    background: isActive ? net.chainBg : 'rgba(255,255,255,0.03)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isActive ? net.chainColor : 'var(--text-secondary)',
                    }}
                  >
                    {net.id}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: isActive ? net.chainColor : 'var(--text-muted)',
                      opacity: 0.85,
                    }}
                  >
                    {net.chain}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '32px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
            }}
          >
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Generating {selectedNetwork} deposit address...
          </div>
        ) : address ? (
          <>
            {/* Network badges */}
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  background: activeNet.chainBg,
                  border: `1px solid ${activeNet.chainBorder}`,
                  color: activeNet.chainColor,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {activeNet.chain}
              </span>
              <span
                style={{
                  background: activeNet.tokenBg,
                  border: `1px solid ${activeNet.tokenBorder}`,
                  color: activeNet.tokenColor,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                USDT {activeNet.label}
              </span>
            </div>

            {qrCode && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img
                  src={qrCode}
                  alt="Deposit QR code"
                  style={{ width: '140px', height: '140px', borderRadius: '10px', border: '4px solid white' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontWeight: 500,
                }}
              >
                Your Deposit Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {address}
                </code>
                <button
                  onClick={copyAddress}
                  style={{
                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    borderRadius: '7px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    color: copied ? '#10B981' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: '#FBBF24',
                padding: '10px 14px',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: '8px',
                marginBottom: '16px',
              }}
            >
              ⚠️ This is a <b>temporary address</b> — valid for <b>60 minutes</b>. {activeNet.warning}
            </div>

            <button
              onClick={checkPayment}
              disabled={checkingPayment}
              style={{
                width: '100%',
                padding: '11px',
                background: 'rgba(99,102,241,0.9)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: checkingPayment ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {checkingPayment ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw size={15} />
                  I've Sent Payment
                </>
              )}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>
            {error || 'Failed to load deposit address. Try again.'}
            {error && (
              <button
                onClick={() => loadAddress(selectedNetwork)}
                style={{
                  display: 'block',
                  margin: '12px auto 0',
                  padding: '8px 16px',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '8px',
                  color: '#818cf8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
