'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Plus, Wallet } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'
import DepositModal from '@/components/ui/DepositModal'

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
}

function statusStyle(s: string) {
  if (s === 'active') return { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' }
  if (s === 'pending_approval') return { bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.25)' }
  if (s === 'paused') return { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: 'rgba(96,165,250,0.25)' }
  if (s === 'completed') return { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' }
  if (s === 'rejected') return { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.25)' }
  return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: 'var(--border)' }
}

export default function AdvertisePage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [loading, setLoading]         = useState(true)
  const [campaigns, setCampaigns]     = useState<any[]>([])
  const [balance, setBalance]         = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) throw new Error('Not authenticated')

        const [{ data: user }, { data: cData, error: cErr }] = await Promise.all([
          supabase.from('users').select('advertiser_balance').eq('id', uid).single(),
          supabase
            .from('ad_campaigns')
            .select('id, title, budget_usd, spent_usd, status, target_audience_count, impressions_count, activity_window, created_at')
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
          <button
            onClick={() => setShowDepositModal(true)}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: 'rgba(99,102,241,0.9)',
              color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            💳 Deposit USDT
          </button>
        </div>
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
              const pct = c.target_audience_count > 0
                ? Math.min(100, (Number(c.impressions_count) / Number(c.target_audience_count)) * 100)
                : 0
              const statusLabel = c.status === 'pending_approval' ? '⏳ Awaiting Approval' : c.status
              return (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{c.title}</div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px',
                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap',
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.18)',
                      color: '#818cf8'
                    }}>
                      {c.activity_window}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Spent: <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.spent_usd).toFixed(2)}</strong>
                      {' '}of{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.budget_usd).toFixed(2)}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Impressions: {Number(c.impressions_count)} / {Number(c.target_audience_count)}
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

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={(newBalance) => {
          setBalance(newBalance)
          toast.success(`Balance updated: $${newBalance.toFixed(2)} ✓`)
        }}
      />
    </div>
  )
}
