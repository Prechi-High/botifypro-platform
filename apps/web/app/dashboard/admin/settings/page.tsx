'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Eye, EyeOff, Settings, DollarSign, Megaphone } from 'lucide-react'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  const [oxapayMerchantKey, setOxapayMerchantKey] = useState('')
  const [oxapaySecretKey, setOxapaySecretKey] = useState('')
  const [showMerchantKey, setShowMerchantKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)

  const [minCampaignBudget, setMinCampaignBudget] = useState(20)
  const [adIntervalHours, setAdIntervalHours] = useState(5)
  const [cpmRate24h, setCpmRate24h] = useState(0.02)
  const [cpmRate48h, setCpmRate48h] = useState(0.015)
  const [cpmRate72h, setCpmRate72h] = useState(0.01)
  const [cpmRate7d, setCpmRate7d] = useState(0.005)

  const [platformFeePercent, setPlatformFeePercent] = useState(10)
  const [proPlanPrice, setProPlanPrice] = useState(10)

  function notify(msg: string, ok = true) {
    setToast({msg, ok})
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('platform_settings').select('*').single()
      if (data) {
        setOxapayMerchantKey(data.oxapay_merchant_key || '')
        setOxapaySecretKey(data.oxapay_secret_key || '')
        setMinCampaignBudget(Number(data.min_campaign_budget_usd || 20))
        setAdIntervalHours(Number(data.ad_interval_hours || 5))
        setCpmRate24h(Number(data.cpm_24hr || 0.02))
        setCpmRate48h(Number(data.cpm_48hr || 0.015))
        setCpmRate72h(Number(data.cpm_72hr || 0.01))
        setCpmRate7d(Number(data.cpm_7day || 0.005))
        setPlatformFeePercent(Number(data.platform_fee_percent || 10))
        setProPlanPrice(Number(data.pro_plan_price || 10))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('platform_settings').upsert({
      id: '1',
      oxapay_merchant_key: oxapayMerchantKey,
      oxapay_secret_key: oxapaySecretKey,
      min_campaign_budget_usd: minCampaignBudget,
      ad_interval_hours: adIntervalHours,
      cpm_24hr: cpmRate24h,
      cpm_48hr: cpmRate48h,
      cpm_72hr: cpmRate72h,
      cpm_7day: cpmRate7d,
      platform_fee_percent: platformFeePercent,
      pro_plan_price: proPlanPrice,
      updated_at: new Date().toISOString()
    })
    if (error) notify(error.message, false)
    else notify('Settings saved ✓')
    setSaving(false)
  }

  const section = (title: string, icon: any, children: any) => (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  )

  const field = (label: string, input: any, hint?: string) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '6px' }}>{label}</label>
      {input}
      {hint && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{hint}</div>}
    </div>
  )

  const secretInput = (value: string, onChange: any, show: boolean, setShow: any, placeholder: string) => (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 44px 9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b', boxSizing: 'border-box' as const }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '11px 16px', borderRadius: '10px', fontSize: '13px',
          background: toast.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
          color: toast.ok ? '#166534' : '#dc2626'
        }}>{toast.msg}</div>
      )}

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            ⚙️ Platform Settings
          </h1>
          <button onClick={save} disabled={saving}
            style={{ padding: '9px 20px', background: '#2563eb', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>

        {loading ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', color: '#64748b', fontSize: '14px' }}>
            Loading settings...
          </div>
        ) : (
          <>
            {section('💳 OxaPay Integration', <DollarSign size={16} color="#2563eb" />, <>
              {field('Merchant API Key', secretInput(oxapayMerchantKey, setOxapayMerchantKey, showMerchantKey, setShowMerchantKey, 'OxaPay Merchant API Key'), 'Used for receiving deposits and creating payment links')}
              {field('Secret Key', secretInput(oxapaySecretKey, setOxapaySecretKey, showSecretKey, setShowSecretKey, 'OxaPay Secret Key'), 'Used to verify webhook callbacks')}
            </>)}

            {section('📢 Ad System Settings', <Megaphone size={16} color="#8b5cf6" />, <>
              {field('Minimum Campaign Budget (USD)',
                <input type="number" min="5" value={minCampaignBudget} onChange={e => setMinCampaignBudget(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />,
                'Minimum budget an advertiser must set for a campaign')}
              {field('Ad Dispatch Interval (hours)',
                <input type="number" min="1" value={adIntervalHours} onChange={e => setAdIntervalHours(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />,
                'How often the ad cron runs (default: 5 hours)')}
              {field('CPM Rate - 24h Window',
                <input type="number" min="0" step="0.001" value={cpmRate24h} onChange={e => setCpmRate24h(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />)}
              {field('CPM Rate - 48h Window',
                <input type="number" min="0" step="0.001" value={cpmRate48h} onChange={e => setCpmRate48h(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />)}
              {field('CPM Rate - 72h Window',
                <input type="number" min="0" step="0.001" value={cpmRate72h} onChange={e => setCpmRate72h(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />)}
              {field('CPM Rate - 7d Window',
                <input type="number" min="0" step="0.001" value={cpmRate7d} onChange={e => setCpmRate7d(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />)}
            </>)}

            {section('💰 Platform Revenue', <Settings size={16} color="#059669" />, <>
              {field('Platform Fee on Withdrawals (%)',
                <input type="number" min="0" max="50" value={platformFeePercent} onChange={e => setPlatformFeePercent(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />,
                'Percentage cut taken from each bot withdrawal')}
              {field('Pro Plan Price (USD/month)',
                <input type="number" min="1" value={proPlanPrice} onChange={e => setProPlanPrice(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }} />,
                'Monthly price for Pro plan charged from advertiser balance')}
            </>)}
          </>
        )}
      </div>
    </div>
  )
}
