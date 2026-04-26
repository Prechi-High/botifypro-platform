'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, ChevronDown, Megaphone, Plus, Wallet } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const ACTIVITY_WINDOWS = [
  { label: 'Standard',      value: 'standard', defaultCpm: 0.6 },
  { label: '24hr Active',   value: '24hr',     defaultCpm: 1.0 },
  { label: '48hr Active',   value: '48hr',     defaultCpm: 1.0 },
  { label: '72hr Active',   value: '72hr',     defaultCpm: 0.9 },
  { label: '7 Day Active',  value: '7day',     defaultCpm: 0.8 },
]

const MIN_BUDGET = 20

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}
const sectionHead: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }
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
          <h3 style={sectionHead}>📝 Ad Content</h3>
          <Field label='Campaign title'>
            <input value={title} onChange={e => setTitle(e.target.value)} className='input-field' placeholder='e.g. Summer sale — 50% off' />
          </Field>
          <Field label='Message text'>
            <textarea value={messageText} onChange={e => setMessageText(e.target.value)} className='input-field' style={{ minHeight: '100px' }} placeholder='Your sponsored message shown to users…' />
          </Field>
          <Field label='Image URL (optional)'>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className='input-field' placeholder='https://…' />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label='Button text (optional)'>
              <input value={buttonText} onChange={e => setButtonText(e.target.value)} className='input-field' placeholder='Learn more' />
            </Field>
            <Field label={buttonText ? 'Button URL *' : 'Button URL (optional)'}>
              <input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} className='input-field' placeholder='https://…' />
            </Field>
          </div>
          {buttonText.trim() && !buttonUrl.trim() && (
            <div style={warnStyle}><AlertCircle size={13} />Button URL is required when button text is set</div>
          )}
        </section>

        {/* Targeting */}
        <section style={sectionStyle}>
          <h3 style={sectionHead}>🎯 Targeting</h3>
          <Field label='Target category'>
            <div style={{ position: 'relative' }}>
              <select value={targetCategory} onChange={e => setTargetCategory(e.target.value)} className='input-field' style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer' }}>
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </Field>
          <Field label='Activity window'>
            <div style={{ position: 'relative' }}>
              <select value={activityWindow} onChange={e => setActivityWindow(e.target.value)} className='input-field' style={{ appearance: 'none', paddingRight: '32px', cursor: 'pointer' }}>
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
          <h3 style={sectionHead}>💰 Budget</h3>
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
