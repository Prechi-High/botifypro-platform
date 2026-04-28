'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Copy, CheckCircle, Loader2, RefreshCw } from 'lucide-react'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newBalance: number) => void
  title?: string
}

export default function DepositModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Deposit USDT',
}: DepositModalProps) {
  const supabase = useMemo(() => createClient(), [])
  const botEngineUrl = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

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
      loadAddress()
    }
  }, [isOpen])

  async function loadAddress() {
    setLoading(true)
    setError('')

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
        body: JSON.stringify({ userId: uid, email: userEmail }),
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
          maxWidth: '420px',
        }}
      >
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

        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '10px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>Current Balance</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ${balance.toFixed(2)}{' '}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>USD</span>
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
            Generating your deposit address...
          </div>
        ) : address ? (
          <>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                display: 'flex',
                gap: '8px',
              }}
            >
              <span
                style={{
                  background: 'rgba(255,0,0,0.1)',
                  border: '1px solid rgba(255,0,0,0.2)',
                  color: '#ff6b6b',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                TRON
              </span>
              <span
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#10B981',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                USDT TRC20
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
              Send USDT (TRC20) only. This is your permanent address and deposits are credited automatically.
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
                  I've Made a Payment - Check Balance
                </>
              )}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>
            {error || 'Failed to load deposit address. Try again.'}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
