'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Eye, EyeOff, Settings, DollarSign, Megaphone, RefreshCw } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
  const [minAdvertiserDeposit, setMinAdvertiserDeposit] = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('platform_settings').select('*').single()
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
        setMinAdvertiserDeposit(Number(data.min_advertiser_deposit_usd || 1))
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
      min_advertiser_deposit_usd: minAdvertiserDeposit,
      updated_at: new Date().toISOString()
    })
    if (error) toast.error(error.message)
    else toast.success('Settings saved ✓')
    setSaving(false)
  }

  function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
          {icon} {title}
        </h3>
        {children}
      </div>
    )
  }

  function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </label>
        {children}
        {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>{hint}</div>}
      </div>
    )
  }

  function SecretInput({ value, onChange, show, setShow, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void; placeholder: string }) {
    return (
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          style={{ paddingRight: '44px' }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} color="var(--accent)" /> Platform Settings
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0', fontFamily: 'Inter, sans-serif' }}>
            Configure OxaPay keys, CPM rates, and revenue settings
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
          style={{ padding: '9px 20px', fontSize: '13px', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
      ) : (
        <>
          <Section title="OxaPay Integration" icon={<DollarSign size={16} color="var(--accent)" />}>
            <Field
              label="Merchant API Key"
              hint="Used for receiving deposits and creating payment links"
            >
              <SecretInput
                value={oxapayMerchantKey}
                onChange={setOxapayMerchantKey}
                show={showMerchantKey}
                setShow={setShowMerchantKey}
                placeholder="OxaPay Merchant API Key"
              />
            </Field>
            <Field
              label="Secret Key"
              hint="Used to verify webhook callbacks"
            >
              <SecretInput
                value={oxapaySecretKey}
                onChange={setOxapaySecretKey}
                show={showSecretKey}
                setShow={setShowSecretKey}
                placeholder="OxaPay Secret Key"
              />
            </Field>
          </Section>

          <Section title="Ad System Settings" icon={<Megaphone size={16} color="var(--accent)" />}>
            <Field
              label="Minimum Campaign Budget (USD)"
              hint="Minimum budget an advertiser must set for a campaign"
            >
              <input
                type="number"
                min="5"
                value={minCampaignBudget}
                onChange={e => setMinCampaignBudget(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="Ad Dispatch Interval (hours)"
              hint="How often the ad cron runs (default: 5 hours)"
            >
              <input
                type="number"
                min="1"
                value={adIntervalHours}
                onChange={e => setAdIntervalHours(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="CPM Rate — 24h Window ($ per 1,000 impressions)"
              hint={`$${minCampaignBudget} budget → ${cpmRate24h > 0 ? Math.floor((minCampaignBudget / cpmRate24h) * 1000).toLocaleString() : '∞'} users`}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={cpmRate24h}
                onChange={e => setCpmRate24h(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="CPM Rate — 48h Window ($ per 1,000 impressions)"
              hint={`$${minCampaignBudget} budget → ${cpmRate48h > 0 ? Math.floor((minCampaignBudget / cpmRate48h) * 1000).toLocaleString() : '∞'} users`}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={cpmRate48h}
                onChange={e => setCpmRate48h(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="CPM Rate — 72h Window ($ per 1,000 impressions)"
              hint={`$${minCampaignBudget} budget → ${cpmRate72h > 0 ? Math.floor((minCampaignBudget / cpmRate72h) * 1000).toLocaleString() : '∞'} users`}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={cpmRate72h}
                onChange={e => setCpmRate72h(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="CPM Rate — 7d Window ($ per 1,000 impressions)"
              hint={`$${minCampaignBudget} budget → ${cpmRate7d > 0 ? Math.floor((minCampaignBudget / cpmRate7d) * 1000).toLocaleString() : '∞'} users`}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={cpmRate7d}
                onChange={e => setCpmRate7d(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <div style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '12px', color: 'var(--accent)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
              Formula: Audience = (Budget ÷ CPM) × 1,000. Example: $20 budget at $1.00 CPM = 20,000 users.
            </div>
          </Section>

          <Section title="Platform Revenue" icon={<DollarSign size={16} color="#FBBF24" />}>
            <Field
              label="Platform Fee on Withdrawals (%)"
              hint="Percentage cut taken from each bot withdrawal"
            >
              <input
                type="number"
                min="0"
                max="50"
                value={platformFeePercent}
                onChange={e => setPlatformFeePercent(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="Pro Plan Price (USD/month)"
              hint="Monthly price for Pro plan charged from advertiser balance"
            >
              <input
                type="number"
                min="1"
                value={proPlanPrice}
                onChange={e => setProPlanPrice(Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field
              label="Min Advertiser Deposit (USD)"
              hint="Minimum deposit amount for advertising balance top-ups"
            >
              <input
                type="number"
                min="1"
                step="0.01"
                value={minAdvertiserDeposit}
                onChange={e => setMinAdvertiserDeposit(Number(e.target.value))}
                className="input-field"
              />
            </Field>
          </Section>
        </>
      )}
    </div>
  )
}
