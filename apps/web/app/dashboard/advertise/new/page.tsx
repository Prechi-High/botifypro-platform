'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, ChevronDown, Edit3, Megaphone, Plus, Target, Wallet, Users } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const ACTIVITY_WINDOWS = [
  { value: '24h',  label: '⚡ Last 24 hours — Most active users' },
  { value: '48h',  label: '🕐 24–48 hours ago — Recently active' },
  { value: '72h',  label: '📅 48–72 hours ago — Moderately active' },
  { value: '7d',   label: '💤 72hrs–7 days ago — Re-engagement' },
]

const AD_BUTTON_TYPES = [
  { value: '',             label: 'Select button type...' },
  { value: 'url',          label: '🔗 Open URL / Website' },
  { value: 'join_channel', label: '📢 Join Channel' },
  { value: 'learn_more',   label: '📖 Learn More' },
  { value: 'get_started',  label: '🚀 Get Started' },
  { value: 'shop_now',     label: '🛒 Shop Now' },
  { value: 'download',     label: '⬇️ Download' },
  { value: 'contact_us',   label: '📞 Contact Us' },
  { value: 'watch_video',  label: '▶️ Watch Video' },
  { value: 'claim_offer',  label: '🎁 Claim Offer' },
  { value: 'subscribe',    label: '🔔 Subscribe' },
  { value: 'view_more',    label: '👀 View More' },
]

// CPM key per window — matches platform_settings columns
const CPM_KEY: Record<string, string> = {
  '24h': 'cpm_24hr',
  '48h': 'cpm_48hr',
  '72h': 'cpm_72hr',
  '7d':  'cpm_7day',
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
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

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [userId, setUserId]           = useState('')
  const [balance, setBalance]         = useState(0)
  const [balanceLoading, setBalanceLoading] = useState(true)

  // CPM rates from platform settings
  const [cpmRates, setCpmRates] = useState<Record<string, number>>({
    cpm_24hr: 1.0,
    cpm_48hr: 1.0,
    cpm_72hr: 0.9,
    cpm_7day: 0.8,
  })
  const [minBudget, setMinBudget] = useState(20)

  const [title, setTitle]             = useState('')
  const [message, setMessage]         = useState('')
  const [imageUrl, setImageUrl]       = useState('')
  const [buttonUrl, setButtonUrl]     = useState('')
  const [activityWindow, setActivityWindow] = useState('24h')
  const [budgetUsd, setBudgetUsd]     = useState<number>(20)
  const [adBtnType, setAdBtnType]     = useState('')
  const [buttonText, setButtonText]   = useState('')
  const [creating, setCreating]       = useState(false)
  const [done, setDone]               = useState(false)
  const [adImagePreview, setAdImagePreview] = useState('')
  const [uploadingAdImage, setUploadingAdImage] = useState(false)

  // Calculated audience from budget + CPM
  const currentCpm = cpmRates[CPM_KEY[activityWindow]] ?? 1.0
  // CPM = cost per 1000 impressions → audience = (budget / cpm) * 1000
  const calculatedAudience = budgetUsd > 0 ? Math.floor((budgetUsd / currentCpm) * 1000) : 0

  useEffect(() => {
    async function loadMeta() {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) return
        setUserId(uid)

        const [{ data: user }, { data: settings }] = await Promise.all([
          supabase.from('users').select('advertiser_balance').eq('id', uid).single(),
          supabase.from('platform_settings').select('cpm_24hr,cpm_48hr,cpm_72hr,cpm_7day,min_campaign_budget_usd').single(),
        ])

        setBalance(Number(user?.advertiser_balance || 0))
        if (settings) {
          setCpmRates({
            cpm_24hr: Number(settings.cpm_24hr ?? 1.0),
            cpm_48hr: Number(settings.cpm_48hr ?? 1.0),
            cpm_72hr: Number(settings.cpm_72hr ?? 0.9),
            cpm_7day: Number(settings.cpm_7day ?? 0.8),
          })
          setMinBudget(Number(settings.min_campaign_budget_usd ?? 20))
          setBudgetUsd(Number(settings.min_campaign_budget_usd ?? 20))
        }
        setBalanceLoading(false)
      } catch (e: any) {
        setBalanceLoading(false)
        toast.error(e?.message || 'Failed to load')
      }
    }
    loadMeta()
  }, [supabase])

  const hasEnoughBalance = balance >= budgetUsd
  const canCreate =
    title.trim() !== '' &&
    message.trim() !== '' &&
    budgetUsd >= minBudget &&
    hasEnoughBalance &&
    imageUrl.startsWith('https://') &&
    adBtnType !== '' &&
    buttonUrl.startsWith('https://')

  async function create() {
    if (!canCreate) return
    setCreating(true)
    try {
      if (!userId) throw new Error('Not authenticated')

      const newBalance = balance - budgetUsd
      const { error: balErr } = await supabase
        .from('users')
        .update({ advertiser_balance: newBalance })
        .eq('id', userId)
      if (balErr) throw balErr

      const { error: campaignError } = await supabase
        .from('ad_campaigns')
        .insert({
          id: crypto.randomUUID(),
          advertiser_id: userId,
          title: title.trim(),
          message: message.trim(),
          image_url: imageUrl.trim(),
          button_text: buttonText.trim() || null,
          button_url: buttonUrl.trim(),
          budget_usd: budgetUsd,
          spent_usd: 0,
          target_audience_count: calculatedAudience,
          impressions_count: 0,
          activity_window: activityWindow,
          status: 'pending_approval',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (campaignError) {
        await supabase.from('users').update({ advertiser_balance: balance }).eq('id', userId)
        throw campaignError
      }

      setBalance(newBalance)
      toast.success('Campaign submitted! Awaiting admin approval.')
      setDone(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create campaign')
      setCreating(false)
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="glass" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} color="var(--accent)" />
          </div>
          <h2 style={{ margin: '0 0 8px' }}>Campaign Submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px', fontFamily: 'Inter, sans-serif' }}>
            Your campaign is awaiting admin approval before it goes live.
          </p>
          <div className="glass" style={{ padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
            {[
              ['Budget charged', `$${budgetUsd.toFixed(2)}`],
              ['Target audience', `${calculatedAudience.toLocaleString()} users`],
              ['CPM rate', `$${currentCpm.toFixed(2)} per 1,000`],
              ['Activity window', ACTIVITY_WINDOWS.find(w => w.value === activityWindow)?.label || activityWindow],
              ['Wallet balance', `$${balance.toFixed(2)}`],
            ].map(([l, v], i, arr) => (
              <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: i < arr.length - 1 ? '8px' : 0, marginBottom: i < arr.length - 1 ? '8px' : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>{l}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/dashboard/advertise')} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px' }}>
            View Campaigns
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Megaphone size={22} color="var(--accent)" /> New Ad Campaign
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
          Your sponsored message will be delivered to active bot users across the network.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Wallet balance */}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
          <Wallet size={16} color="var(--accent)" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
            Wallet balance: <strong style={{ color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
              {balanceLoading ? '—' : `$${balance.toFixed(2)}`}
            </strong>
          </span>
          {!balanceLoading && balance < minBudget && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#FBBF24', fontFamily: 'Inter, sans-serif' }}>
              Top up needed →{' '}
              <a href="/dashboard/advertise" style={{ color: 'var(--accent)' }}>Wallet</a>
            </span>
          )}
        </div>

        {/* Ad Content */}
        <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Edit3 size={15} color="var(--accent)" /> Ad Content
          </h3>
          <Field label="Campaign title">
            <input value={title} onChange={e => setTitle(e.target.value)} className="input-field" placeholder="e.g. Summer sale — 50% off" />
          </Field>
          <Field label="Message text">
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="input-field" style={{ minHeight: '90px' }} placeholder="Your sponsored message shown to users..." />
          </Field>
          <Field label="Image URL *" hint="Must start with https://">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={imageUrl} onChange={e => { setImageUrl(e.target.value); setAdImagePreview(e.target.value) }} className="input-field" placeholder="https://example.com/image.jpg" />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px dashed var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                {uploadingAdImage ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5000000) { toast.error('Image too large. Max 5MB.'); return }
                  setUploadingAdImage(true)
                  try {
                    const fileName = `ad-${Date.now()}.${file.name.split('.').pop()}`
                    const { error } = await supabase.storage.from('broadcast-images').upload(fileName, file, { upsert: true })
                    if (error) throw error
                    const { data: urlData } = supabase.storage.from('broadcast-images').getPublicUrl(fileName)
                    setImageUrl(urlData.publicUrl)
                    setAdImagePreview(urlData.publicUrl)
                    toast.success('Image uploaded ✓')
                  } catch (err: any) { toast.error('Upload failed: ' + err.message) }
                  setUploadingAdImage(false)
                }} />
              </label>
              {adImagePreview && (
                <div style={{ position: 'relative' }}>
                  <img src={adImagePreview} alt="Preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} onError={() => setAdImagePreview('')} />
                  <button onClick={() => { setImageUrl(''); setAdImagePreview('') }} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              )}
            </div>
          </Field>
          <Field label="Button Type *">
            <select value={adBtnType} onChange={e => { setAdBtnType(e.target.value); setButtonText(AD_BUTTON_TYPES.find(t => t.value === e.target.value)?.label.replace(/^[^\w]+/, '') || '') }} className="input-field" style={{ color: 'var(--text-primary)' }}>
              {AD_BUTTON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Button URL *" hint="Must start with https://">
            <input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} className="input-field" placeholder="https://..." />
          </Field>
        </div>

        {/* Targeting + Budget */}
        <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={15} color="var(--accent)" /> Targeting &amp; Budget
          </h3>

          <Field label="Activity window">
            <div style={{ position: 'relative' }}>
              <select value={activityWindow} onChange={e => setActivityWindow(e.target.value)} className="input-field" style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                {ACTIVITY_WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </Field>

          <Field label={`Budget (USD) — minimum $${minBudget}`}>
            <input
              type="number"
              min={minBudget}
              step="1"
              value={budgetUsd}
              onChange={e => setBudgetUsd(Math.max(0, Number(e.target.value)))}
              className="input-field"
            />
          </Field>

          {/* Auto-calculated audience preview */}
          <div style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Users size={15} color="var(--accent)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estimated Reach</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Target Audience', value: calculatedAudience > 0 ? calculatedAudience.toLocaleString() + ' users' : '—' },
                { label: 'CPM Rate', value: `$${currentCpm.toFixed(2)} / 1,000` },
                { label: 'Budget', value: `$${budgetUsd.toFixed(2)}` },
                { label: 'Window', value: activityWindow },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              Audience = (Budget ÷ CPM) × 1,000. CPM rates are set by the platform admin.
            </div>
          </div>

          {budgetUsd > 0 && budgetUsd < minBudget && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#FBBF24', padding: '8px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={13} /> Minimum budget is ${minBudget}
            </div>
          )}
          {budgetUsd >= minBudget && !balanceLoading && !hasEnoughBalance && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#FBBF24', padding: '8px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={13} /> Insufficient balance (${balance.toFixed(2)}). Top up your wallet first.
            </div>
          )}
        </div>

        <button
          onClick={create}
          disabled={creating || !canCreate}
          className={canCreate && !creating ? 'btn-primary' : 'btn-ghost'}
          style={{ padding: '13px', borderRadius: '10px', fontSize: '14px', opacity: creating || !canCreate ? 0.5 : 1, cursor: creating || !canCreate ? 'not-allowed' : 'pointer' }}
        >
          {creating ? 'Creating...' : <><Plus size={16} /> Create Campaign</>}
        </button>
      </div>
    </div>
  )
}
