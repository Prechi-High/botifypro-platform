'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Settings, ShieldAlert, Banknote } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  const [minCampaignBudgetUsd, setMinCampaignBudgetUsd] = useState(20)
  const [adIntervalHours, setAdIntervalHours] = useState(5)
  const [cpmStandard, setCpmStandard] = useState(0.6)
  const [cpm24hr, setCpm24hr] = useState(1.0)
  const [cpm48hr, setCpm48hr] = useState(1.0)
  const [cpm72hr, setCpm72hr] = useState(0.9)
  const [cpm7day, setCpm7day] = useState(0.8)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) throw new Error('Not authenticated')

        const { data: user } = await supabase.from('users').select('role').eq('id', userId).single()
        if (cancelled) return
        if (user?.role !== 'admin') { setIsAdmin(false); setLoading(false); return }
        setIsAdmin(true)

        const { data: ps, error } = await supabase.from('platform_settings').select('*').limit(1).single()
        if (error) throw error
        if (cancelled) return

        setSettingsId(ps.id)
        setMinCampaignBudgetUsd(ps.min_campaign_budget_usd)
        setAdIntervalHours(ps.ad_interval_hours)
        setCpmStandard(ps.cpm_standard)
        setCpm24hr(ps.cpm_24hr)
        setCpm48hr(ps.cpm_48hr)
        setCpm72hr(ps.cpm_72hr)
        setCpm7day(ps.cpm_7day)
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  async function save() {
    if (!settingsId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          min_campaign_budget_usd: minCampaignBudgetUsd,
          ad_interval_hours: adIntervalHours,
          cpm_standard: cpmStandard,
          cpm_24hr: cpm24hr,
          cpm_48hr: cpm48hr,
          cpm_72hr: cpm72hr,
          cpm_7day: cpm7day,
        })
        .eq('id', settingsId)
      if (error) throw error
      toast.success('Settings saved!')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!loading && isAdmin === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: '16px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={28} color='#EF4444' />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Access denied</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>This page is restricted to platform administrators.</p>
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px',
  }
  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
  }

  const cpmRows = [
    { label: 'Standard',     value: cpmStandard, set: setCpmStandard },
    { label: '24hr Active',  value: cpm24hr,     set: setCpm24hr },
    { label: '48hr Active',  value: cpm48hr,     set: setCpm48hr },
    { label: '72hr Active',  value: cpm72hr,     set: setCpm72hr },
    { label: '7 Day Active', value: cpm7day,     set: setCpm7day },
  ]

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={22} color='#6366f1' />Platform Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          Configure platform-wide ad delivery rates and limits.
        </p>
      </div>

      {loading ? (
        <div className='skeleton' style={{ height: '320px', borderRadius: '16px' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={sectionStyle}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Settings size={16} /> General</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Min campaign budget (USD)</label>
                <input
                  type='number' step='1' min='1'
                  value={minCampaignBudgetUsd}
                  onChange={e => setMinCampaignBudgetUsd(Number(e.target.value))}
                  className='input-field'
                />
              </div>
              <div>
                <label style={labelStyle}>Ad interval (hours)</label>
                <input
                  type='number' step='1' min='1'
                  value={adIntervalHours}
                  onChange={e => setAdIntervalHours(Number(e.target.value))}
                  className='input-field'
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Min hours between ads per user
                </div>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> CPM Rates (USD per 1,000 users)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {cpmRows.map(row => (
                <div key={row.label}>
                  <label style={labelStyle}>{row.label} ($)</label>
                  <input
                    type='number' step='0.01' min='0'
                    value={row.value}
                    onChange={e => row.set(Number(e.target.value))}
                    className='input-field'
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              background: saving ? '#93c5fd' : '#2563eb',
              color: 'white', fontSize: '14px', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {saving ? 'Saving…' : <><CheckCircle size={16} />Save Settings</>}
          </button>
        </div>
      )}
    </div>
  )
}
