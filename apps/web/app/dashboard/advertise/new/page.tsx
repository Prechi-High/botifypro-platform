'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, ChevronDown, Megaphone, Plus, Wallet, Edit3, Target } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const ACTIVITY_WINDOWS = [
  { label: 'Standard',      value: 'standard', defaultCpm: 0.6 },
  { label: '24hr Active',   value: '24hr',     defaultCpm: 1.0 },
  { label: '48hr Active',   value: '48hr',     defaultCpm: 1.0 },
  { label: '72hr Active',   value: '72hr',     defaultCpm: 0.9 },
  { label: '7 Day Active',  value: '7day',     defaultCpm: 0.8 },
]

const MIN_BUDGET = 20

const AD_BUTTON_TYPES = [
  { value: '', label: 'Select button type...' },
  { value: 'url', label: '🔗 Open URL / Website' },
  { value: 'join_channel', label: '📢 Join Channel' },
  { value: 'learn_more', label: '📖 Learn More' },
  { value: 'get_started', label: '🚀 Get Started' },
  { value: 'shop_now', label: '🛒 Shop Now' },
  { value: 'download', label: '⬇️ Download' },
  { value: 'contact_us', label: '📞 Contact Us' },
  { value: 'watch_video', label: '▶️ Watch Video' },
  { value: 'claim_offer', label: '🎁 Claim Offer' },
  { value: 'subscribe', label: '🔔 Subscribe' },
  { value: 'view_more', label: '👀 View More' },
]

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}
const sectionHead: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }
const warnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: '12px', color: '#FBBF24',
  padding: '7px 10px',
  background: 'rgba(245,158,11,0.1)',
  borderRadius: '6px',
  border: '1px solid rgba(245,158,11,0.2)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [userId, setUserId] = useState('')
  const [balance, setBalance] = useState(0)
  const [balanceLoading, setBalanceLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [messageText, setMessageText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [targetCategory, setTargetCategory] = useState('all')
  const [categories, setCategories] = useState<string[]>(['all'])
  const [activityWindow, setActivityWindow] = useState('standard')
  const [budgetUsd, setBudgetUsd] = useState<number>(MIN_BUDGET)
  const [creating, setCreating] = useState(false)
  const [cpmRates, setCpmRates] = useState<Record<string, number>>({
    standard: 0.6, '24hr': 1.0, '48hr': 1.0, '72hr': 0.9, '7day': 0.8,
  })

  const [done, setDone] = useState(false)
  const [adImagePreview, setAdImagePreview] = useState('')
  const [uploadingAdImage, setUploadingAdImage] = useState(false)
  const [adBtnType, setAdBtnType] = useState('')

  useEffect(() => {
    async function loadMeta() {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) return
        setUserId(uid)

        const [{ data: user }, { data: bots }, { data: ps }] = await Promise.all([
          supabase.from('users').select('advertiser_balance').eq('id', uid).single(),
          supabase.from('bots').select('category'),
          supabase.from('platform_settings').select('*').limit(1).single(),
        ])
        setBalance(Number(user?.advertiser_balance || 0))
        setBalanceLoading(false)

        if (bots) {
          const unique = Array.from(new Set(bots.map((b: any) => b.category).filter(Boolean))) as string[]
          setCategories(['all', ...unique])
        }
        if (ps) {
          setCpmRates({
            standard: ps.cpm_standard ?? 0.6,
            '24hr':   ps.cpm_24hr    ?? 1.0,
            '48hr':   ps.cpm_48hr    ?? 1.0,
            '72hr':   ps.cpm_72hr    ?? 0.9,
            '7day':   ps.cpm_7day    ?? 0.8,
          })
        }
      } catch (e: any) {
        setBalanceLoading(false)
        toast.error(e?.message || 'Failed to load')
      }
    }
    loadMeta()
  }, [supabase])

  const selectedWindow = ACTIVITY_WINDOWS.find(w => w.value === activityWindow)!
  const effectiveCpm = cpmRates[activityWindow] ?? selectedWindow.defaultCpm
  const estimatedReach = budgetUsd > 0 ? Math.floor((budgetUsd / effectiveCpm) * 1000) : 0
  const hasEnoughBalance = balance >= budgetUsd
  const canCreate =
    title.trim() !== '' &&
    messageText.trim() !== '' &&
    budgetUsd >= MIN_BUDGET &&
    hasEnoughBalance &&
    (!buttonText.trim() || buttonUrl.trim() !== '')

  async function create() {
    if (!canCreate) return
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      toast.error('Valid image URL required (must start with https://)'); return
    }
    if (!title?.trim()) { toast.error('Title is required'); return }
    if (!messageText?.trim()) { toast.error('Message text is required'); return }
    if (!adBtnType) { toast.error('Button type is required'); return }
    if (!buttonUrl || !buttonUrl.startsWith('https://')) {
      toast.error('Valid button URL required (must start with https://)'); return
    }
    setCreating(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const advertiserId = auth.user?.id
      if (!advertiserId) throw new Error('Not authenticated')

      // Deduct from wallet first
      const newBalance = balance - budgetUsd
      const { error: balErr } = await supabase
        .from('users')
        .update({ advertiser_balance: newBalance })
        .eq('id', advertiserId)
      if (balErr) throw balErr

      const { error: cErr } = await supabase
        .from('ad_campaigns')
        .insert({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          advertiser_id: advertiserId,
          title: title.trim(),
          message_text: messageText.trim(),
          image_url: imageUrl.trim() || null,
          button_text: buttonText.trim() || null,
          button_url: buttonUrl.trim() || null,
          target_category: targetCategory,
          activity_window: activityWindow,
          cpm_rate: effectiveCpm,
          budget_usd: budgetUsd,
          spent_usd: 0,
          status: 'approved',
          users_reached: 0,
        })
      if (cErr) {
        // Refund balance on campaign insert failure
        await supabase.from('users').update({ advertiser_balance: balance }).eq('id', advertiserId)
        throw cErr
      }

      setBalance(newBalance)
      setDone(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create campaign')
      setCreating(false)
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '16px', padding: '36px 32px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} color='#10B981' />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Campaign approved!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px' }}>
            Your campaign is live and will start delivering to users.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
            <Row label='Budget charged'     value={`$${budgetUsd.toFixed(2)}`} />
            <Row label='Estimated reach'    value={`${estimatedReach.toLocaleString()} users`} />
            <Row label='Activity window'    value={selectedWindow.label} />
            <Row label='Wallet balance'     value={`$${balance.toFixed(2)}`} last />
          </div>

          <button
            onClick={() => router.push('/dashboard/advertise')}
            style={{ background: '#2563eb', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
          >
            View campaigns
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Megaphone size={22} color='#8b5cf6' />New Ad Campaign
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          Your sponsored message will be delivered to active bot users across the network.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Wallet balance */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '10px', padding: '12px 14px',
        }}>
          <Wallet size={16} color='#8b5cf6' />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Wallet balance:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {balanceLoading ? '—' : `$${balance.toFixed(2)}`}
            </strong>
          </span>
          {!balanceLoading && balance < MIN_BUDGET && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#FBBF24' }}>
              Top up needed →{' '}
              <a href='/dashboard/advertise' style={{ color: '#3b82f6', textDecoration: 'none' }}>Wallet</a>
            </span>
          )}
        </div>

        {/* Ad content */}
        <section style={sectionStyle}>
          <h3 style={sectionHead}><Edit3 size={16} /> Ad Content</h3>
          <Field label='Campaign title'>
            <input value={title} onChange={e => setTitle(e.target.value)} className='input-field' placeholder='e.g. Summer sale — 50% off' />
          </Field>
          <Field label='Message text'>
            <textarea value={messageText} onChange={e => setMessageText(e.target.value)} className='input-field' style={{ minHeight: '100px' }} placeholder='Your sponsored message shown to users…' />
          </Field>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Image <span style={{color:'#EF4444'}}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={imageUrl}
                onChange={e => { setImageUrl(e.target.value); setAdImagePreview(e.target.value) }}
                className="input-field"
                placeholder="https://example.com/image.jpg"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or</span>
                <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px', borderRadius: '8px', cursor: 'pointer',
                border: '1px dashed rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-secondary)', fontSize: '13px'
              }}>
                {uploadingAdImage ? '⏳ Uploading...' : '📁 Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5000000) { toast.error('Image too large. Max 5MB.'); return }
                    setUploadingAdImage(true)
                    try {
                      const fileExt = file.name.split('.').pop()
                      const fileName = `ad-${Date.now()}.${fileExt}`
                      const { error } = await supabase.storage
                        .from('broadcast-images')
                        .upload(fileName, file, { upsert: true })
                      if (error) throw error
                      const { data: urlData } = supabase.storage
                        .from('broadcast-images')
                        .getPublicUrl(fileName)
                      setImageUrl(urlData.publicUrl)
                      setAdImagePreview(urlData.publicUrl)
                      toast.success('Image uploaded ✓')
                    } catch (err: any) {
                      toast.error('Upload failed: ' + err.message)
                    }
                    setUploadingAdImage(false)
                  }}
                />
              </label>
              {adImagePreview && (
                <div style={{ position: 'relative' }}>
                  <img src={adImagePreview} alt="Preview"
                    style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px' }}
                    onError={() => setAdImagePreview('')}
                  />
                  <button onClick={() => { setImageUrl(''); setAdImagePreview('') }}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '14px' }}>
                    ×
                  </button>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Must start with https://</div>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Button Type <span style={{color:'#EF4444'}}>*</span></label>
            <select
              value={adBtnType}
              onChange={e => { setAdBtnType(e.target.value); setButtonText(AD_BUTTON_TYPES.find(t => t.value === e.target.value)?.label.replace(/^[^\w]+/, '') || '') }}
              className="input-field"
              style={{ color: '#1e293b', background: 'white' }}
            >
              {AD_BUTTON_TYPES.map(t => <option key={t.value} value={t.value} style={{color:'#1e293b'}}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Button URL *</label>
            <input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} className='input-field' placeholder='https://…' />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Must start with https://
            </div>
          </div>
        </section>

        {/* Targeting */}
        <section style={sectionStyle}>
          <h3 style={sectionHead}><Target size={16} /> Targeting</h3>
          <Field label='Target category'>
            <div style={{ position: 'relative' }}>
              <select value={targetCategory} onChange={e => setTargetCategory(e.target.value)} className='input-field' style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer', color: '#1e293b', background: 'white' }}>
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </Field>
          <Field label='Activity window'>
            <div style={{ position: 'relative' }}>
              <select value={activityWindow} onChange={e => setActivityWindow(e.target.value)} className='input-field' style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer', color: '#1e293b', background: 'white' }}>
                {ACTIVITY_WINDOWS.map(w => (
                  <option key={w.value} value={w.value}>
                    {w.label} (${(cpmRates[w.value] ?? w.defaultCpm).toFixed(2)} CPM)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </Field>
        </section>

        {/* Budget & calculator */}
        <section style={sectionStyle}>
          <h3 style={sectionHead}><Wallet size={16} /> Budget</h3>
          <Field label={`Budget (USD) — minimum $${MIN_BUDGET}`}>
            <input value={budgetUsd} onChange={e => setBudgetUsd(Math.max(0, Number(e.target.value)))} type='number' min={MIN_BUDGET} step='1' className='input-field' />
          </Field>
          {budgetUsd > 0 && budgetUsd < MIN_BUDGET && (
            <div style={warnStyle}><AlertCircle size={13} />Minimum budget is ${MIN_BUDGET}</div>
          )}
          {budgetUsd >= MIN_BUDGET && !balanceLoading && !hasEnoughBalance && (
            <div style={warnStyle}>
              <AlertCircle size={13} />
              Insufficient wallet balance (${balance.toFixed(2)}). Top up your wallet first.
            </div>
          )}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>CPM rate</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${effectiveCpm.toFixed(2)} per 1,000 users</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estimated reach</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{estimatedReach.toLocaleString()} users</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(99,102,241,0.2)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total cost</span>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>${budgetUsd.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <button
          onClick={create}
          disabled={creating || !canCreate}
          style={{
            padding: '13px', borderRadius: '10px', border: 'none',
            background: creating || !canCreate ? 'rgba(37,99,235,0.4)' : '#2563eb',
            color: 'white', fontSize: '14px', fontWeight: 600,
            cursor: creating || !canCreate ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {creating ? 'Creating…' : <><Plus size={16} />Create &amp; Launch Campaign</>}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: last ? 0 : '8px', marginBottom: last ? 0 : '8px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
