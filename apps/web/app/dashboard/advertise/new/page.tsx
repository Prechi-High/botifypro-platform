'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, ChevronDown, Edit3, Megaphone, Plus, Target, Wallet } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const ACTIVITY_WINDOWS = [
  { value: '24h', label: '⚡ Last 24 hours — Most active users' },
  { value: '48h', label: '🕐 24–48 hours ago — Recently active' },
  { value: '72h', label: '📅 48–72 hours ago — Moderately active' },
  { value: '7d', label: '💤 72hrs–7 days ago — Re-engagement' },
]

const MIN_BUDGET = 20
const MIN_TARGET_AUDIENCE = 100

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

const sectionHead: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  margin: 0,
}

const warnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: '#FBBF24',
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
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [activityWindow, setActivityWindow] = useState('24h')
  const [budgetUsd, setBudgetUsd] = useState<number>(MIN_BUDGET)
  const [targetAudience, setTargetAudience] = useState<number>(500)
  const [creating, setCreating] = useState(false)

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

        const { data: user } = await supabase
          .from('users')
          .select('advertiser_balance')
          .eq('id', uid)
          .single()

        setBalance(Number(user?.advertiser_balance || 0))
        setBalanceLoading(false)
      } catch (e: any) {
        setBalanceLoading(false)
        toast.error(e?.message || 'Failed to load')
      }
    }

    loadMeta()
  }, [supabase, toast])

  const selectedWindow = ACTIVITY_WINDOWS.find((window) => window.value === activityWindow)
  const hasEnoughBalance = balance >= budgetUsd
  const canCreate =
    title.trim() !== '' &&
    message.trim() !== '' &&
    budgetUsd >= MIN_BUDGET &&
    targetAudience >= MIN_TARGET_AUDIENCE &&
    hasEnoughBalance &&
    (!buttonText.trim() || buttonUrl.trim() !== '')

  async function create() {
    if (!canCreate) return
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      toast.error('Valid image URL required (must start with https://)')
      return
    }
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!message.trim()) {
      toast.error('Message text is required')
      return
    }
    if (!adBtnType) {
      toast.error('Button type is required')
      return
    }
    if (!buttonUrl || !buttonUrl.startsWith('https://')) {
      toast.error('Valid button URL required (must start with https://)')
      return
    }

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
          image_url: imageUrl.trim() || null,
          button_text: buttonText.trim() || null,
          button_url: buttonUrl.trim() || null,
          budget_usd: budgetUsd,
          spent_usd: 0,
          target_audience_count: targetAudience,
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
      toast.success('Campaign submitted! Awaiting admin approval before going live.')
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
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Campaign submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 24px' }}>
            Your campaign is awaiting admin approval before it goes live.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
            <Row label='Budget charged' value={`$${budgetUsd.toFixed(2)}`} />
            <Row label='Target audience' value={`${targetAudience.toLocaleString()} users`} />
            <Row label='Activity window' value={selectedWindow?.label || activityWindow} />
            <Row label='Wallet balance' value={`$${balance.toFixed(2)}`} last />
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

        <section style={sectionStyle}>
          <h3 style={sectionHead}><Edit3 size={16} /> Ad Content</h3>
          <Field label='Campaign title'>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className='input-field' placeholder='e.g. Summer sale - 50% off' />
          </Field>
          <Field label='Message text'>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className='input-field' style={{ minHeight: '100px' }} placeholder='Your sponsored message shown to users...' />
          </Field>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Image <span style={{ color: '#EF4444' }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setAdImagePreview(e.target.value)
                }}
                className='input-field'
                placeholder='https://example.com/image.jpg'
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
                {uploadingAdImage ? 'Uploading...' : 'Upload Image'}
                <input
                  type='file'
                  accept='image/*'
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5000000) {
                      toast.error('Image too large. Max 5MB.')
                      return
                    }

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
                  <img
                    src={adImagePreview}
                    alt='Preview'
                    style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px' }}
                    onError={() => setAdImagePreview('')}
                  />
                  <button
                    onClick={() => {
                      setImageUrl('')
                      setAdImagePreview('')
                    }}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', fontSize: '14px' }}
                  >
                    x
                  </button>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Must start with https://</div>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Button Type <span style={{ color: '#EF4444' }}>*</span></label>
            <select
              value={adBtnType}
              onChange={(e) => {
                setAdBtnType(e.target.value)
                setButtonText(AD_BUTTON_TYPES.find((type) => type.value === e.target.value)?.label.replace(/^[^\w]+/, '') || '')
              }}
              className='input-field'
              style={{ color: '#1e293b', background: 'white' }}
            >
              {AD_BUTTON_TYPES.map((type) => (
                <option key={type.value} value={type.value} style={{ color: '#1e293b' }}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Button URL *</label>
            <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} className='input-field' placeholder='https://...' />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Must start with https://
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHead}><Target size={16} /> Targeting</h3>
          <Field label='Activity window'>
            <div style={{ position: 'relative' }}>
              <select value={activityWindow} onChange={(e) => setActivityWindow(e.target.value)} className='input-field' style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer', color: '#1e293b', background: 'white' }}>
                {ACTIVITY_WINDOWS.map((window) => (
                  <option key={window.value} value={window.value}>
                    {window.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </Field>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Target Audience Size *</label>
            <input
              type='number'
              min='100'
              step='50'
              value={targetAudience}
              onChange={(e) => setTargetAudience(Math.max(0, Number(e.target.value)))}
              placeholder='e.g. 500 (minimum 100)'
              className='input-field'
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Minimum 100 users. Budget ÷ audience = cost per person.
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={sectionHead}><Wallet size={16} /> Budget</h3>
          <Field label={`Budget (USD) - minimum $${MIN_BUDGET}`}>
            <input value={budgetUsd} onChange={(e) => setBudgetUsd(Math.max(0, Number(e.target.value)))} type='number' min={MIN_BUDGET} step='1' className='input-field' />
          </Field>
          {budgetUsd > 0 && budgetUsd < MIN_BUDGET && (
            <div style={warnStyle}><AlertCircle size={13} />Minimum budget is ${MIN_BUDGET}</div>
          )}
          {targetAudience > 0 && targetAudience < MIN_TARGET_AUDIENCE && (
            <div style={warnStyle}><AlertCircle size={13} />Minimum target audience is {MIN_TARGET_AUDIENCE} users</div>
          )}
          {budgetUsd >= MIN_BUDGET && !balanceLoading && !hasEnoughBalance && (
            <div style={warnStyle}>
              <AlertCircle size={13} />
              Insufficient wallet balance (${balance.toFixed(2)}). Top up your wallet first.
            </div>
          )}
          {budgetUsd && targetAudience > 0 && (
            <div style={{ fontSize: '12px', color: '#60A5FA', padding: '10px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px' }}>
              Cost per person: ${(budgetUsd / targetAudience).toFixed(4)} USD
              {' '}— Total budget: ${budgetUsd} for {targetAudience} people
            </div>
          )}
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
          {creating ? 'Creating...' : <><Plus size={16} />Create Campaign</>}
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
