'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, ArrowUpRight, Megaphone, Plus, Wallet } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://1-touchbot-engine.onrender.com'

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

function statusStyle(s: string) {
  if (s === 'approved') return { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' }
  if (s === 'pending')  return { bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.25)' }
  return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: 'var(--border)' }
}

export default function AdvertisePage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [loading, setLoading]         = useState(true)
  const [campaigns, setCampaigns]     = useState<any[]>([])
  const [balance, setBalance]         = useState(0)
  const [userId, setUserId]           = useState('')
  const [topupAmount, setTopupAmount] = useState<number>(20)
  const [topupLoading, setTopupLoading] = useState(false)
  const [paymentUrl, setPaymentUrl]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) throw new Error('Not authenticated')
        setUserId(uid)

        const [{ data: user }, { data: cData, error: cErr }] = await Promise.all([
          supabase.from('users').select('advertiser_balance').eq('id', uid).single(),
          supabase
            .from('ad_campaigns')
            .select('id, title, budget_usd, spent_usd, status, target_category, created_at')
            .eq('advertiser_id', uid)
            .order('created_at', { ascending: false }),
        ])
        if (cErr) throw cErr
        if (cancelled) return
        setBalance(Number(user?.advertiser_balance || 0))
        setCampaigns(cData || [])
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  async function topUp() {
    if (topupAmount < 5) { toast.error('Minimum top-up is $5'); return }
    setTopupLoading(true)
    setPaymentUrl(null)
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/payments/create-topup-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountUsd: topupAmount }),
      })
      const data = await res.json()
      if (data.paymentUrl) {
        setPaymentUrl(data.paymentUrl)
      } else {
        toast.error(data.error || 'Failed to create payment link')
      }
    } catch {
      toast.error('Could not reach payment service')
    } finally {
      setTopupLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={22} color='#8b5cf6' />Advertise
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Manage your ad campaigns and wallet balance.
          </p>
        </div>
        <Link
          href='/dashboard/advertise/new'
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: 'white', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          <Plus size={15} />New Campaign
        </Link>
      </div>

      {/* Wallet */}
      <div style={{ ...sectionStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={20} color='#8b5cf6' />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>Advertiser wallet</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {loading ? '—' : `$${balance.toFixed(2)}`}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>
              Amount (USD)
            </label>
            <input
              type='number'
              min={5}
              step={5}
              value={topupAmount}
              onChange={e => setTopupAmount(Math.max(0, Number(e.target.value)))}
              className='input-field'
              style={{ width: '130px' }}
            />
          </div>
          <button
            onClick={topUp}
            disabled={topupLoading || !userId}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: topupLoading ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.9)',
              color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: topupLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {topupLoading ? 'Generating…' : 'Top Up via OxaPay'}
          </button>
        </div>

        {paymentUrl && (
          <a
            href={paymentUrl}
            target='_blank'
            rel='noreferrer'
            style={{
              marginTop: '12px',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              color: '#10B981', padding: '10px 14px', borderRadius: '8px',
              fontSize: '13px', fontWeight: 500, textDecoration: 'none',
            }}
          >
            <ArrowUpRight size={14} />
            Pay ${topupAmount.toFixed(2)} — click to open OxaPay
          </a>
        )}
      </div>

      {/* Campaigns */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Your campaigns
        </h3>

        {loading ? (
          <div className='skeleton' style={{ height: '80px', borderRadius: '10px' }} />
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No campaigns yet.{' '}
            <Link href='/dashboard/advertise/new' style={{ color: '#3b82f6', textDecoration: 'none' }}>
              Create your first →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {campaigns.map(c => {
              const sc = statusStyle(c.status)
              const pct = c.budget_usd > 0 ? Math.min(100, (Number(c.spent_usd) / Number(c.budget_usd)) * 100) : 0
              return (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{c.title}</div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px',
                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap',
                    }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Budget: <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.budget_usd).toFixed(2)}</strong>
                    {' · '}Spent: <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.spent_usd).toFixed(2)}</strong>
                    {' · '}Target: {c.target_category}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                    <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, borderRadius: '999px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
