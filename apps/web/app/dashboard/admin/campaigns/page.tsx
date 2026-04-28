'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Pause, Play } from 'lucide-react'

export default function AdminCampaignsPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  function notify(msg: string, ok = true) {
    setToast({msg, ok})
    setTimeout(() => setToast(null), 3500)
  }

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
      if (data.success) { notify(`Campaign ${endpoint}d ✓`); load() }
      else notify(data.error || 'Failed', false)
    } catch { notify('Request failed', false) }
  }

  const statusColor: any = {
    pending_approval: '#FBBF24',
    active: '#10B981',
    paused: '#60A5FA',
    completed: '#94a3b8',
    rejected: '#EF4444'
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '11px 16px', borderRadius: '10px', fontSize: '13px',
          background: toast.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
          color: toast.ok ? '#166534' : '#dc2626'
        }}>{toast.msg}</div>
      )}

      <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
        📢 Ad Campaigns — Admin
      </h1>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No campaigns yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map(c => (
            <div key={c.id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    By: {c.users?.email} · Window: {c.activity_window} · Budget: ${Number(c.budget_usd).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Target: {c.target_audience_count} users · Reached: {c.impressions_count} · Spent: ${Number(c.spent_usd).toFixed(4)}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                  color: statusColor[c.status] || '#94a3b8',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${statusColor[c.status] || '#94a3b8'}40`,
                  whiteSpace: 'nowrap'
                }}>{c.status}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {c.status === 'pending_approval' && (
                  <>
                    <button onClick={() => action(c.id, 'approve')}
                      style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '7px', color: '#10B981', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button onClick={() => action(c.id, 'reject')}
                      style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#FCA5A5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {c.status === 'active' && (
                  <button onClick={() => action(c.id, 'pause', { action: 'pause' })}
                    style={{ padding: '6px 14px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '7px', color: '#60A5FA', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Pause size={13} /> Pause
                  </button>
                )}
                {c.status === 'paused' && (
                  <button onClick={() => action(c.id, 'pause', { action: 'resume' })}
                    style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '7px', color: '#10B981', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

