'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Pause, Play, Megaphone, RefreshCw } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminCampaignsPage() {
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('ad_campaigns')
      .select('*, users(email)')
      .order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function action(id: string, endpoint: string, body?: any) {
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      })
      const data = await res.json()
      if (data.success) { toast.success(`Campaign ${endpoint}d ✓`); load() }
      else toast.error(data.error || 'Failed')
    } catch { toast.error('Request failed') }
  }

  const statusColor: Record<string, string> = {
    pending_approval: '#FBBF24',
    active: 'var(--accent)',
    paused: '#60A5FA',
    completed: '#94a3b8',
    rejected: '#EF4444'
  }

  const statusBg: Record<string, string> = {
    pending_approval: 'rgba(245,158,11,0.1)',
    active: 'rgba(57,255,20,0.1)',
    paused: 'rgba(96,165,250,0.1)',
    completed: 'rgba(148,163,184,0.1)',
    rejected: 'rgba(239,68,68,0.1)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={22} color="var(--accent)" /> Ad Campaigns
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0', fontFamily: 'Inter, sans-serif' }}>
            Approve, reject, or manage all advertising campaigns
          </p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: '8px 14px', fontSize: '13px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
          <Megaphone size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: '12px' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No campaigns yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {campaigns.map(c => (
            <div key={c.id} className="glass" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>{c.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', marginBottom: '2px' }}>
                    By: {c.users?.email} · Window: {c.activity_window} · Budget: ${Number(c.budget_usd).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    Target: {c.target_audience_count} users · Reached: {c.impressions_count} · Spent: ${Number(c.spent_usd).toFixed(4)}
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: statusColor[c.status] || '#94a3b8',
                  background: statusBg[c.status] || 'rgba(255,255,255,0.05)',
                  border: `1px solid ${statusColor[c.status] || '#94a3b8'}40`,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.04em',
                  textTransform: 'capitalize',
                  flexShrink: 0,
                }}>
                  {c.status?.replace('_', ' ')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                {c.status === 'pending_approval' && (
                  <>
                    <button
                      onClick={() => action(c.id, 'approve')}
                      style={{ padding: '6px 14px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => action(c.id, 'reject')}
                      style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', color: '#FCA5A5', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {c.status === 'active' && (
                  <button
                    onClick={() => action(c.id, 'pause', { action: 'pause' })}
                    style={{ padding: '6px 14px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--radius-sm)', color: '#60A5FA', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    <Pause size={13} /> Pause
                  </button>
                )}
                {c.status === 'paused' && (
                  <button
                    onClick={() => action(c.id, 'pause', { action: 'resume' })}
                    style={{ padding: '6px 14px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    <Play size={13} /> Resume
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
