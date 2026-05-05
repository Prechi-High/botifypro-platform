'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, Plus, ThumbsUp, Zap, Trophy, Medal, Gift, ExternalLink, Info, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

const sectionCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px',
  color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px'
}

type InvestmentPlan = {
  id?: string
  name: string
  activationAmount: number
  durationDays: number
  dailyBonus: number
  referralReward: number
  tierEnabled: boolean
  tier1Percent: number
  tier2Percent: number
  tier3Percent: number
  isActive: boolean
  sortOrder: number
  expanded?: boolean
}

function newPlan(sortOrder: number): InvestmentPlan {
  return {
    name: `Plan ${sortOrder + 1}`,
    activationAmount: 10,
    durationDays: 30,
    dailyBonus: 50,
    referralReward: 200,
    tierEnabled: false,
    tier1Percent: 40,
    tier2Percent: 20,
    tier3Percent: 5,
    isActive: true,
    sortOrder,
    expanded: true,
  }
}

export default function CommandsPage() {
  const params = useParams()
  const botId = params.botId as string
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')
  const [loading, setLoading] = useState(true)
  const [savingFeatures, setSavingFeatures] = useState(false)

  // Built-in command toggles
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false)
  const [dailyBonusEnabled, setDailyBonusEnabled] = useState(false)
  const [withdrawEnabled, setWithdrawEnabled] = useState(false)
  const [referralRewardAmount, setReferralRewardAmount] = useState(100)

  // Currency
  const [currencySymbol, setCurrencySymbol] = useState('🪙')
  const [currencyName, setCurrencyName] = useState('Coins')

  // Command settings
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'7days' | '30days'>('7days')
  const [leaderboardBonus1, setLeaderboardBonus1] = useState(1000)
  const [leaderboardBonus2, setLeaderboardBonus2] = useState(500)
  const [leaderboardBonus3, setLeaderboardBonus3] = useState(250)
  const [dailyBonusAmount, setDailyBonusAmount] = useState(10)

  // Wishlist
  const [wishes, setWishes] = useState<any[]>([])
  const [loadingWishes, setLoadingWishes] = useState(true)
  const [wishTitle, setWishTitle] = useState('')
  const [wishDesc, setWishDesc] = useState('')
  const [addingWish, setAddingWish] = useState(false)

  // Investment / Pro Plan — global settings
  const [proPlanEnabled, setProPlanEnabled] = useState(false)
  const [proPlanButtonLabel, setProPlanButtonLabel] = useState('💎 Invest')
  const [savingProPlan, setSavingProPlan] = useState(false)

  // Investment plans list
  const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([])
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  // Plan UI mode: 'collapsed' | 'view' | 'edit' | 'delete'
  const [planMode, setPlanMode] = useState<Record<number, 'collapsed' | 'view' | 'edit' | 'delete'>>({})
  const [deleteConfirmText, setDeleteConfirmText] = useState<Record<number, string>>({})

  // Button counting
  const fixedCount = 2
  const optionalEnabled = [leaderboardEnabled, dailyBonusEnabled, withdrawEnabled].filter(Boolean).length
  const totalActive = fixedCount + optionalEnabled
  const limit = userPlan === 'pro' ? 14 : 4
  const canAddMore = totalActive < limit

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id ?? null
        if (!cancelled) setUserId(uid)

        if (uid) {
          const { data: userRow } = await supabase
            .from('users').select('plan').eq('id', uid).single()
          if (!cancelled && userRow)
            setUserPlan(userRow.plan === 'pro' ? 'pro' : 'free')
        }

        const { data: settings } = await supabase
          .from('bot_settings').select('*').eq('bot_id', botId).single()
        if (!cancelled && settings) {
          setLeaderboardEnabled(Boolean(settings.leaderboard_enabled))
          setDailyBonusEnabled(Boolean(settings.bonus_enabled))
          setWithdrawEnabled(Boolean(settings.withdraw_enabled))
          setReferralRewardAmount(Number(settings.referral_reward_amount) || 100)
          setLeaderboardPeriod(settings.leaderboard_period || '7days')
          setLeaderboardBonus1(Number(settings.leaderboard_bonus_1) || 1000)
          setLeaderboardBonus2(Number(settings.leaderboard_bonus_2) || 500)
          setLeaderboardBonus3(Number(settings.leaderboard_bonus_3) || 250)
          setDailyBonusAmount(Number(settings.daily_bonus_amount) || 10)
          setCurrencySymbol(settings.currency_symbol || '🪙')
          setCurrencyName(settings.currency_name || 'Coins')
          setProPlanEnabled(Boolean(settings.pro_plan_enabled))
          setProPlanButtonLabel(settings.pro_plan_button_label || '💎 Invest')
        }

        // Load investment plans
        const { data: plans } = await supabase
          .from('investment_plans')
          .select('*')
          .eq('bot_id', botId)
          .order('sort_order', { ascending: true })
        if (!cancelled && plans) {
          setInvestmentPlans(plans.map((p: any) => ({
            id: p.id,
            name: p.name,
            activationAmount: Number(p.activation_amount),
            durationDays: Number(p.duration_days),
            dailyBonus: Number(p.daily_bonus),
            referralReward: Number(p.referral_reward),
            tierEnabled: Boolean(p.tier_enabled),
            tier1Percent: Number(p.tier1_percent),
            tier2Percent: Number(p.tier2_percent),
            tier3Percent: Number(p.tier3_percent),
            isActive: Boolean(p.is_active),
            sortOrder: Number(p.sort_order),
            expanded: false,
          })))
        }

        const { data: wishData } = await supabase
          .from('command_wishlist').select('*').order('upvotes', { ascending: false })
        if (!cancelled) setWishes(wishData ?? [])
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || 'Failed to load')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingWishes(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [botId, supabase])

  function handleOptionalToggle(key: 'leaderboard' | 'bonus' | 'withdraw', currentEnabled: boolean) {
    if (!currentEnabled && !canAddMore) {
      toast.error(`Button limit reached on the ${userPlan} plan`)
      return
    }
    if (key === 'leaderboard') setLeaderboardEnabled(!currentEnabled)
    if (key === 'bonus') setDailyBonusEnabled(!currentEnabled)
    if (key === 'withdraw') setWithdrawEnabled(!currentEnabled)
  }

  async function saveFeatures() {
    setSavingFeatures(true)
    try {
      const { error } = await supabase.from('bot_settings').update({
        balance_enabled: true,
        referral_enabled: true,
        leaderboard_enabled: leaderboardEnabled,
        bonus_enabled: dailyBonusEnabled,
        withdraw_enabled: withdrawEnabled,
        referral_reward_amount: referralRewardAmount,
        leaderboard_period: leaderboardPeriod,
        leaderboard_bonus_1: leaderboardBonus1,
        leaderboard_bonus_2: leaderboardBonus2,
        leaderboard_bonus_3: leaderboardBonus3,
        daily_bonus_amount: dailyBonusAmount,
        daily_bonus_enabled: dailyBonusEnabled,
      }).eq('bot_id', botId)
      if (error) throw error
      toast.success('Commands saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
    setSavingFeatures(false)
  }

  async function saveProPlanGlobal() {
    if (userPlan !== 'pro') { toast.error('Investment Plan requires a Pro account'); return }
    setSavingProPlan(true)
    try {
      const { error } = await supabase.from('bot_settings').update({
        pro_plan_enabled: proPlanEnabled,
        pro_plan_button_label: proPlanButtonLabel || '💎 Invest',
      }).eq('bot_id', botId)
      if (error) throw error
      toast.success('Investment settings saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
    setSavingProPlan(false)
  }

  function updatePlan(index: number, field: keyof InvestmentPlan, value: any) {
    setInvestmentPlans(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function addPlan() {
    setInvestmentPlans(prev => [...prev, newPlan(prev.length)])
  }

  async function savePlan(index: number) {
    const plan = investmentPlans[index]
    const tempId = plan.id || `saving-${index}`
    setSavingPlanId(tempId)
    try {
      const payload = {
        bot_id: botId,
        name: plan.name,
        activation_amount: plan.activationAmount,
        duration_days: plan.durationDays,
        daily_bonus: plan.dailyBonus,
        referral_reward: plan.referralReward,
        tier_enabled: plan.tierEnabled,
        tier1_percent: plan.tier1Percent,
        tier2_percent: plan.tier2Percent,
        tier3_percent: plan.tier3Percent,
        is_active: plan.isActive,
        sort_order: plan.sortOrder,
      }
      if (plan.id) {
        const { error } = await supabase.from('investment_plans').update(payload).eq('id', plan.id)
        if (error) throw error
      } else {
        // Generate ID client-side — Supabase doesn't auto-generate cuid() defaults
        const newId = crypto.randomUUID()
        const { data, error } = await supabase
          .from('investment_plans')
          .insert({ id: newId, ...payload })
          .select()
          .single()
        if (error) throw error
        setInvestmentPlans(prev => prev.map((p, i) => i === index ? { ...p, id: data.id } : p))
      }
      toast.success(`${plan.name} saved!`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save plan')
    }
    setSavingPlanId(null)
  }

  async function deletePlan(index: number) {
    const plan = investmentPlans[index]
    if (!plan.id) {
      setInvestmentPlans(prev => prev.filter((_, i) => i !== index))
      setPlanMode(prev => { const n = { ...prev }; delete n[index]; return n })
      return
    }
    setDeletingPlanId(plan.id)
    try {
      // Reset all users on this plan back to normal (isProMember=false, activePlanId=null)
      await supabase.from('bot_users')
        .update({ is_pro_member: false, pro_expires_at: null, active_plan_id: null })
        .eq('active_plan_id', plan.id)
      const { error } = await supabase.from('investment_plans').delete().eq('id', plan.id)
      if (error) throw error
      setInvestmentPlans(prev => prev.filter((_, i) => i !== index))
      setPlanMode(prev => { const n = { ...prev }; delete n[index]; return n })
      setDeleteConfirmText(prev => { const n = { ...prev }; delete n[index]; return n })
      toast.success('Plan deleted. Affected users reset to normal.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete plan')
    }
    setDeletingPlanId(null)
  }

  async function submitWish() {
    if (!wishTitle.trim()) { toast.error('Title is required'); return }
    if (!userId) { toast.error('You must be logged in to submit'); return }
    setAddingWish(true)
    // Check if user already submitted a wish this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { count: thisMonthCount } = await supabase
      .from('command_wishlist')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)
      .gte('created_at', monthStart.toISOString())
    if ((thisMonthCount || 0) >= 1) {
      toast.error('You can only submit one feature request per month.')
      setAddingWish(false)
      return
    }
    const { error } = await supabase.from('command_wishlist').insert({
      title: wishTitle.trim(),
      description: wishDesc.trim() || null,
      created_by: userId,
      upvotes: 0
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Wish submitted!')
      setWishTitle('')
      setWishDesc('')
      const { data } = await supabase.from('command_wishlist').select('*').order('upvotes', { ascending: false })
      setWishes(data ?? [])
    }
    setAddingWish(false)
  }

  async function upvoteWish(id: string, current: number) {
    if (!userId) { toast.error('Log in to upvote'); return }
    const { error } = await supabase.from('command_wishlist').update({ upvotes: current + 1 }).eq('id', id)
    if (!error) setWishes(prev => prev.map(w => w.id === id ? { ...w, upvotes: current + 1 } : w))
    else toast.error(error.message)
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Commands</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Manage built-in commands and suggest new features.
        </p>
      </div>

      {loading ? (
        <div style={sectionCard}>
          <div className="skeleton" style={{ width: '100%', height: '200px' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Built-in commands ── */}
          <div style={sectionCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Built-in commands</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{totalActive} / {limit} buttons</span>
                <div style={{ width: '72px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (totalActive / limit) * 100)}%`, height: '100%', background: totalActive >= limit ? '#ef4444' : 'var(--blue-primary, #2563eb)', borderRadius: '3px', transition: 'width 0.2s' }} />
                </div>
              </div>
            </div>

            {!canAddMore && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: '#FBBF24' }}>
                <Lock size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
                <div>
                  {limit}-button limit reached on the {userPlan} plan.
                  {userPlan === 'free' && <> <a href="/dashboard/upgrade" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>Upgrade to Pro for up to 14 buttons →</a></>}
                </div>
              </div>
            )}

            {(['balance', 'referral'] as const).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', flexShrink: 0 }}>/{key}</code>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {key === 'balance' ? `Show user's ${currencyName.toLowerCase()} balance` : `Generate referral link, earn ${currencyName.toLowerCase()} for invites`}
                  </span>
                  <span style={{ fontSize: '10px', color: '#818cf8', background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>always on</span>
                </div>
                <div className="toggle-track on" style={{ opacity: 0.5, pointerEvents: 'none', flexShrink: 0 }}>
                  <div className="toggle-thumb" />
                </div>
              </div>
            ))}

            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginTop: '8px' }}>
              <label style={labelStyle}>Referral reward amount ({currencyName})</label>
              <input type="number" value={referralRewardAmount} onChange={e => setReferralRewardAmount(Number(e.target.value))} className="input-field" style={{ maxWidth: '200px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{referralRewardAmount} {currencySymbol} per successful referral</div>
            </div>

            {/* Leaderboard */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trophy size={14} /> Leaderboard</code>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Top referrers board with period rewards</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {!leaderboardEnabled && !canAddMore && <Lock size={13} color='#6b7280' />}
                  <div className={`toggle-track ${leaderboardEnabled ? 'on' : 'off'}`} onClick={() => handleOptionalToggle('leaderboard', leaderboardEnabled)} style={{ cursor: !leaderboardEnabled && !canAddMore ? 'not-allowed' : 'pointer' }}>
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>
              {leaderboardEnabled && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Reward release period</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['7days', '30days'] as const).map(p => (
                        <button key={p} onClick={() => setLeaderboardPeriod(p)} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${leaderboardPeriod === p ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`, background: leaderboardPeriod === p ? 'rgba(59,130,246,0.1)' : 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: leaderboardPeriod === p ? 600 : 400 }}>
                          {p === '7days' ? '7 Days' : '30 Days'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}><Medal size={14} color="#FBBF24" /> 1st place bonus</label>
                      <input type="number" value={leaderboardBonus1} onChange={e => setLeaderboardBonus1(Number(e.target.value))} className="input-field" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}><Medal size={14} color="#9CA3AF" /> 2nd place bonus</label>
                      <input type="number" value={leaderboardBonus2} onChange={e => setLeaderboardBonus2(Number(e.target.value))} className="input-field" />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}><Medal size={14} color="#D97706" /> 3rd place bonus</label>
                      <input type="number" value={leaderboardBonus3} onChange={e => setLeaderboardBonus3(Number(e.target.value))} className="input-field" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Bonus */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Gift size={14} /> Daily Bonus</code>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Users claim free {currencyName.toLowerCase()} once every 24 hours</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {!dailyBonusEnabled && !canAddMore && <Lock size={13} color='#6b7280' />}
                  <div className={`toggle-track ${dailyBonusEnabled ? 'on' : 'off'}`} onClick={() => handleOptionalToggle('bonus', dailyBonusEnabled)} style={{ cursor: !dailyBonusEnabled && !canAddMore ? 'not-allowed' : 'pointer' }}>
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>
              {dailyBonusEnabled && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                  <label style={labelStyle}>Daily bonus amount ({currencyName})</label>
                  <input type="number" value={dailyBonusAmount} onChange={e => setDailyBonusAmount(Number(e.target.value))} className="input-field" style={{ maxWidth: '200px' }} />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{dailyBonusAmount} {currencySymbol} credited to user balance each day</div>
                </div>
              )}
            </div>

            {/* Withdraw */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ExternalLink size={14} /> Withdraw</code>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Users submit withdrawal requests</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {!withdrawEnabled && !canAddMore && <Lock size={13} color='#6b7280' />}
                  <div className={`toggle-track ${withdrawEnabled ? 'on' : 'off'}`} onClick={() => handleOptionalToggle('withdraw', withdrawEnabled)} style={{ cursor: !withdrawEnabled && !canAddMore ? 'not-allowed' : 'pointer' }}>
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>
              {withdrawEnabled && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(255,170,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', fontSize: '12px', color: '#FBBF24', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Info size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>Configure payout API keys in Bot Settings → Withdrawal Settings first.</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              <button onClick={saveFeatures} disabled={savingFeatures} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {savingFeatures ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Saving...</> : 'Save commands'}
              </button>
            </div>
          </div>

          {/* ── Investment / Pro Plan ── */}
          <div style={{ ...sectionCard, border: userPlan === 'pro' ? '1px solid rgba(57,255,20,0.2)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>💎 Investment Plans</h3>
                {userPlan !== 'pro' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '999px', padding: '2px 8px' }}>
                    <Lock size={10} /> PRO ONLY
                  </span>
                )}
              </div>
              {userPlan === 'pro' && (
                <div className={`toggle-track ${proPlanEnabled ? 'on' : 'off'}`} onClick={() => setProPlanEnabled(!proPlanEnabled)} style={{ flexShrink: 0 }}>
                  <div className="toggle-thumb" />
                </div>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Allow bot users to deposit and join investment plans. Each plan has its own daily bonus, referral reward, and optional 3-tier commission.
              {userPlan !== 'pro' && <span style={{ color: 'var(--accent)', fontWeight: 600 }}> Upgrade to Pro to activate.</span>}
            </p>

            {userPlan === 'pro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Global settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                  <div>
                    <label style={labelStyle}>Invest button label</label>
                    <input value={proPlanButtonLabel} onChange={e => setProPlanButtonLabel(e.target.value)} className="input-field" placeholder="💎 Invest" />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Shown in bot keyboard</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button onClick={saveProPlanGlobal} disabled={savingProPlan} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                      {savingProPlan ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Saving...</> : 'Save settings'}
                    </button>
                  </div>
                </div>

                {/* Plans list */}
                {proPlanEnabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Plans ({investmentPlans.length})
                      </div>
                      <button onClick={addPlan} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 14px' }}>
                        <Plus size={14} /> Add Plan
                      </button>
                    </div>

                    {investmentPlans.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No plans yet. Click "Add Plan" to create your first investment plan.
                      </div>
                    )}

                    {investmentPlans.map((plan, index) => {
                      const mode = planMode[index] || 'collapsed'
                      return (
                      <div key={plan.id || index} style={{ border: '1px solid rgba(57,255,20,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Plan header — always visible */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(57,255,20,0.04)', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>💎 {plan.name || `Plan ${index + 1}`}</span>
                            {!plan.isActive && <span style={{ fontSize: '10px', color: '#FBBF24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '1px 6px' }}>INACTIVE</span>}
                            {!plan.id && <span style={{ fontSize: '10px', color: '#60A5FA', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '4px', padding: '1px 6px' }}>UNSAVED</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => setPlanMode(prev => ({ ...prev, [index]: mode === 'view' ? 'collapsed' : 'view' }))}
                              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#818cf8', fontSize: '12px', fontWeight: 500 }}>
                              {mode === 'view' ? 'Close' : 'View'}
                            </button>
                            <button onClick={() => setPlanMode(prev => ({ ...prev, [index]: mode === 'edit' ? 'collapsed' : 'edit' }))}
                              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#60A5FA', fontSize: '12px', fontWeight: 500 }}>
                              {mode === 'edit' ? 'Close' : 'Edit'}
                            </button>
                            <button onClick={() => setPlanMode(prev => ({ ...prev, [index]: mode === 'delete' ? 'collapsed' : 'delete' }))}
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#FCA5A5', fontSize: '12px', fontWeight: 500 }}>
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* VIEW mode */}
                        {mode === 'view' && (
                          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
                            {[
                              ['Activation', plan.activationAmount + ' USDT'],
                              ['Duration', plan.durationDays + ' days'],
                              ['Daily Bonus', plan.dailyBonus + ' ' + currencySymbol],
                              ['Referral Reward', plan.referralReward + ' ' + currencySymbol],
                              ['3-Tier Commission', plan.tierEnabled ? `L1:${plan.tier1Percent}% L2:${plan.tier2Percent}% L3:${plan.tier3Percent}%` : 'Disabled'],
                              ['Status', plan.isActive ? 'Active' : 'Inactive'],
                            ].map(([label, value]) => (
                              <div key={String(label)} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* EDIT mode */}
                        {mode === 'edit' && (
                          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                              <label style={labelStyle}>Plan name</label>
                              <input value={plan.name} onChange={e => updatePlan(index, 'name', e.target.value)} className="input-field" placeholder="e.g. Tier 1, Gold Plan..." />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label style={labelStyle}>Activation amount (USD)</label>
                                <input type="number" min="1" value={plan.activationAmount} onChange={e => updatePlan(index, 'activationAmount', Number(e.target.value))} className="input-field" />
                              </div>
                              <div>
                                <label style={labelStyle}>Duration (days)</label>
                                <input type="number" min="1" value={plan.durationDays} onChange={e => updatePlan(index, 'durationDays', Number(e.target.value))} className="input-field" />
                              </div>
                              <div>
                                <label style={labelStyle}>Daily bonus ({currencySymbol})</label>
                                <input type="number" min="0" value={plan.dailyBonus} onChange={e => updatePlan(index, 'dailyBonus', Number(e.target.value))} className="input-field" />
                              </div>
                              <div>
                                <label style={labelStyle}>Referral reward ({currencySymbol})</label>
                                <input type="number" min="0" value={plan.referralReward} onChange={e => updatePlan(index, 'referralReward', Number(e.target.value))} className="input-field" />
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Plan active</div>
                              <div className={`toggle-track ${plan.isActive ? 'on' : 'off'}`} onClick={() => updatePlan(index, 'isActive', !plan.isActive)} style={{ flexShrink: 0 }}>
                                <div className="toggle-thumb" />
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>3-Tier Referral Commission</div>
                                <div className={`toggle-track ${plan.tierEnabled ? 'on' : 'off'}`} onClick={() => updatePlan(index, 'tierEnabled', !plan.tierEnabled)} style={{ flexShrink: 0 }}>
                                  <div className="toggle-thumb" />
                                </div>
                              </div>
                              {plan.tierEnabled && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                  <div><label style={labelStyle}>Level 1 (%)</label><input type="number" min="0" max="100" value={plan.tier1Percent} onChange={e => updatePlan(index, 'tier1Percent', Number(e.target.value))} className="input-field" /></div>
                                  <div><label style={labelStyle}>Level 2 (%)</label><input type="number" min="0" max="100" value={plan.tier2Percent} onChange={e => updatePlan(index, 'tier2Percent', Number(e.target.value))} className="input-field" /></div>
                                  <div><label style={labelStyle}>Level 3 (%)</label><input type="number" min="0" max="100" value={plan.tier3Percent} onChange={e => updatePlan(index, 'tier3Percent', Number(e.target.value))} className="input-field" /></div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => savePlan(index).then(() => setPlanMode(prev => ({ ...prev, [index]: 'collapsed' })))}
                              disabled={savingPlanId === (plan.id || `saving-${index}`)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {savingPlanId === (plan.id || `saving-${index}`) ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Saving...</> : '💾 Save changes'}
                            </button>
                          </div>
                        )}

                        {/* DELETE mode */}
                        {mode === 'delete' && (
                          <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.04)', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                            <div style={{ fontSize: '13px', color: '#FCA5A5', marginBottom: '10px', lineHeight: 1.5 }}>
                              ⚠️ This will permanently delete <strong>{plan.name}</strong> and reset all users on this plan to normal users.
                              <br />Type <strong style={{ color: '#ef4444' }}>DELETE</strong> to confirm:
                            </div>
                            <input
                              value={deleteConfirmText[index] || ''}
                              onChange={e => setDeleteConfirmText(prev => ({ ...prev, [index]: e.target.value }))}
                              placeholder="DELETE"
                              className="input-field"
                              style={{ marginBottom: '10px', borderColor: deleteConfirmText[index] === 'DELETE' ? 'rgba(239,68,68,0.5)' : undefined }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => deletePlan(index)}
                                disabled={deleteConfirmText[index] !== 'DELETE' || deletingPlanId === plan.id}
                                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: deleteConfirmText[index] === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.2)', color: deleteConfirmText[index] === 'DELETE' ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600, cursor: deleteConfirmText[index] === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                                {deletingPlanId === plan.id ? 'Deleting...' : '🗑️ Delete Plan'}
                              </button>
                              <button onClick={() => { setPlanMode(prev => ({ ...prev, [index]: 'collapsed' })); setDeleteConfirmText(prev => ({ ...prev, [index]: '' })) }}
                                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Feature wishlist ── */}
          <div style={sectionCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} />
              Feature wishlist
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Suggest new bot commands. Shared across all bots — top requests get built first.
            </p>

            {userId ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={labelStyle}>Feature title</label>
                    <input value={wishTitle} onChange={e => setWishTitle(e.target.value)} className="input-field" placeholder="e.g. Daily quiz game" />
                  </div>
                  <div>
                    <label style={labelStyle}>Description (optional)</label>
                    <input value={wishDesc} onChange={e => setWishDesc(e.target.value)} className="input-field" placeholder="Describe how it would work..." onKeyDown={e => e.key === 'Enter' && submitWish()} />
                  </div>
                </div>
                <button onClick={submitWish} disabled={addingWish || !wishTitle.trim()} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {addingWish ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                  {addingWish ? 'Submitting...' : 'Submit wish'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                Log in to submit or upvote feature requests.
              </div>
            )}

            {loadingWishes ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Loading...
              </div>
            ) : wishes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No feature requests yet. Be the first!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {wishes.map((w: any) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    <button
                      onClick={() => upvoteWish(w.id, w.upvotes)}
                      disabled={!userId}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '6px 10px', cursor: userId ? 'pointer' : 'not-allowed', flexShrink: 0, opacity: userId ? 1 : 0.5 }}
                    >
                      <ThumbsUp size={13} color='#818cf8' />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#818cf8' }}>{w.upvotes}</span>
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{w.title}</div>
                      {w.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{w.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
