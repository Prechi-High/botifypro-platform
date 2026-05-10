'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Plus, Wallet, Eye, X, AlertCircle, ChevronRight } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'
import DepositModal from '@/components/ui/DepositModal'

function statusStyle(s: string) {
  if (s === 'active') return { bg: 'rgba(57,255,20,0.1)', color: 'var(--accent)', border: 'rgba(57,255,20,0.25)' }
  if (s === 'pending_approval') return { bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.25)' }
  if (s === 'paused') return { bg: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: 'rgba(96,165,250,0.25)' }
  if (s === 'completed') return { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' }
  if (s === 'rejected') return { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.25)' }
  return { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' }
}

export default function AdvertisePage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [loading, setLoading]         = useState(true)
  const [campaigns, setCampaigns]     = useState<any[]>([])
  const [balance, setBalance]         = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [previewCampaign, setPreviewCampaign] = useState<any|null>(null)

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
            .select('id, title, message, image_url, button_text, button_url, budget_usd, spent_usd, status, rejection_reason, target_audience_count, impressions_count, activity_window, created_at')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Ad Preview Modal */}
      {previewCampaign && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setPreviewCampaign(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '20px', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ height: '2px', background: 'var(--accent-gradient)' }} />
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Ad Preview</h3>
              <button onClick={() => setPreviewCampaign(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase' }}>
                  HOW IT APPEARS IN TELEGRAM
                </div>
                {previewCampaign.image_url && (
                  <img src={previewCampaign.image_url} alt="" style={{ width: '100%', borderRadius: '8px', marginBottom: '10px', maxHeight: '200px', objectFit: 'cover' }} />
                )}
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: (previewCampaign.message || '').replace(/\n/g, '<br/>') }}
                />
                {previewCampaign.button_text && previewCampaign.button_url && (
                  <div style={{ marginTop: '10px' }}>
                    <a href={previewCampaign.button_url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: 'inline-block', padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                      {previewCampaign.button_text}
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  ['Status', previewCampaign.status?.replace('_', ' ')],
                  ['Activity Window', previewCampaign.activity_window],
                  ['Budget', `$${Number(previewCampaign.budget_usd).toFixed(2)}`],
                  ['Spent', `$${Number(previewCampaign.spent_usd).toFixed(2)}`],
                  ['Target Audience', Number(previewCampaign.target_audience_count).toLocaleString()],
                  ['Impressions', `${previewCampaign.impressions_count}/${previewCampaign.target_audience_count}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'Inter, sans-serif' }}>{l}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize', fontFamily: "'Space Grotesk', sans-serif" }}>{v}</div>
                  </div>
                ))}
              </div>
              {previewCampaign.rejection_reason && (
                <div style={{ fontSize: '13px', color: '#FCA5A5', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start', fontFamily: 'Inter, sans-serif' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span><strong>Rejection reason:</strong> {previewCampaign.rejection_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={22} color="var(--accent)" /> Advertise
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>
            Manage your ad campaigns and wallet balance.
          </p>
        </div>
        <Link
          href="/dashboard/advertise/new"
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '9px 16px', fontSize: '13px', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap' }}
        >
          <Plus size={15} /> New Campaign
        </Link>
      </div>

      {/* Wallet */}
      <div className="glass" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'Inter, sans-serif' }}>Advertiser wallet</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {loading ? '—' : `$${balance.toFixed(2)}`}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button
            onClick={() => setShowDepositModal(true)}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
          >
            <Wallet size={15} /> Deposit USDT
          </button>
        </div>
      </div>

      {/* Campaigns */}
      <div className="glass" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
            Your campaigns
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
            {campaigns.length} total
          </span>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-md)' }} />
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            No campaigns yet.{' '}
            <Link href="/dashboard/advertise/new" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
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
              const statusLabel = c.status === 'pending_approval' ? 'Awaiting Approval' : c.status
              return (
                <div key={c.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', transition: 'var(--transition)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'Space Grotesk', sans-serif" }}>{c.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => setPreviewCampaign(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-card)', background: 'var(--bg-card)', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        <Eye size={11} /> Preview
                      </button>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'capitalize' }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)', color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                      {c.activity_window}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                      Spent: <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.spent_usd).toFixed(2)}</strong>
                      {' '}of{' '}
                      <strong style={{ color: 'var(--text-secondary)' }}>${Number(c.budget_usd).toFixed(2)}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                    Impressions: {Number(c.impressions_count)} / {Number(c.target_audience_count)}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--accent)', height: '100%', width: `${pct}%`, borderRadius: '999px', transition: 'width 0.3s', boxShadow: '0 0 8px var(--accent-glow)' }} />
                  </div>
                  {c.status === 'rejected' && c.rejection_reason && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#FCA5A5', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: '6px', fontFamily: 'Inter, sans-serif' }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span><strong>Rejection reason:</strong> {c.rejection_reason}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        purpose="advertiser"
        onSuccess={(newBalance) => {
          setBalance(newBalance)
          toast.success(`Balance updated: $${newBalance.toFixed(2)} ✓`)
        }}
      />
    </div>
  )
}
