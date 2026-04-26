'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Lock, MessageSquareReply, Plus, ThumbsUp, Trash2, Zap
} from 'lucide-react'
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

  // Auto replies
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(true)
  const [newCmd, setNewCmd] = useState('')
  const [newResp, setNewResp] = useState('')
  const [adding, setAdding] = useState(false)

  // Wishlist
  const [wishes, setWishes] = useState<any[]>([])
  const [loadingWishes, setLoadingWishes] = useState(true)
  const [wishTitle, setWishTitle] = useState('')
  const [wishDesc, setWishDesc] = useState('')
  const [addingWish, setAddingWish] = useState(false)

  // Button counting
  const fixedCount = 2 // Balance + Referral always count
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
        }

        const { data: cmds } = await supabase
          .from('bot_commands').select('*')
          .eq('bot_id', botId).eq('is_prebuilt', false)
          .order('created_at', { ascending: false })
        if (!cancelled) setReplies(cmds ?? [])

        const { data: wishData } = await supabase
          .from('command_wishlist').select('*').order('upvotes', { ascending: false })
        if (!cancelled) setWishes(wishData ?? [])
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || 'Failed to load')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingReplies(false)
          setLoadingWishes(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [botId, supabase])

  function handleOptionalToggle(
    key: 'leaderboard' | 'bonus' | 'withdraw',
    currentEnabled: boolean
  ) {
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
        referral_reward_amount: referralRewardAmount
      }).eq('bot_id', botId)
      if (error) throw error
      toast.success('Commands saved!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
    setSavingFeatures(false)
  }

  async function addReply() {
    if (!newCmd.trim() || !newResp.trim()) { toast.error('Both fields required'); return }
    setAdding(true)
    const { error } = await supabase.from('bot_commands').insert({
      id: crypto.randomUUID(),
      bot_id: botId,
      command: newCmd.trim(),
      response_text: newResp.trim(),
      is_active: true,
      command_category: 'custom',
      is_prebuilt: false,
      prebuilt_key: null
    })
    if (error) {
      toast.error(error.code === '23505' ? 'That trigger already exists' : error.message)
    } else {
      toast.success('Auto reply added ✓')
      setNewCmd('')
      setNewResp('')
      const { data } = await supabase
        .from('bot_commands').select('*')
        .eq('bot_id', botId).eq('is_prebuilt', false)
        .order('created_at', { ascending: false })
      setReplies(data ?? [])
    }
    setAdding(false)
  }

  async function deleteReply(id: string, command: string) {
    if (!confirm(`Delete auto reply for "${command}"?`)) return
    const { error } = await supabase.from('bot_commands').delete().eq('id', id)
    if (!error) { toast.success('Deleted ✓'); setReplies(prev => prev.filter(c => c.id !== id)) }
    else toast.error(error.message)
  }

  async function toggleReply(id: string, current: boolean) {
    await supabase.from('bot_commands').update({ is_active: !current }).eq('id', id)
    setReplies(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c))
  }

  async function submitWish() {
    if (!wishTitle.trim()) { toast.error('Title is required'); return }
    if (!userId) { toast.error('You must be logged in to submit'); return }
    setAddingWish(true)
    const { error } = await supabase.from('command_wishlist').insert({
      title: wishTitle.trim(),
      description: wishDesc.trim() || null,
      created_by: userId,
      upvotes: 0
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Wish submitted! ✓')
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

  const optionals: { key: 'leaderboard' | 'bonus' | 'withdraw'; label: string; desc: string; enabled: boolean }[] = [
    { key: 'bonus', label: '/bonus', desc: 'Claim daily free coin reward', enabled: dailyBonusEnabled },
    { key: 'leaderboard', label: '/leaderboard', desc: 'Show top 10 users by balance', enabled: leaderboardEnabled },
    { key: 'withdraw', label: '/withdraw', desc: 'Submit a withdrawal request', enabled: withdrawEnabled },
  ]

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Commands</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Manage built-in commands, auto replies, and suggest new features.
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {totalActive} / {limit} buttons
                </span>
                <div style={{ width: '72px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (totalActive / limit) * 100)}%`,
                    height: '100%',
                    background: totalActive >= limit ? '#ef4444' : 'var(--blue-primary, #2563eb)',
                    borderRadius: '3px',
                    transition: 'width 0.2s'
                  }} />
                </div>
              </div>
            </div>

            {!canAddMore && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: '#FBBF24' }}>
                <Lock size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
                <div>
                  {limit}-button limit reached on the {userPlan} plan.
                  {userPlan === 'free' && (
                    <> <a href="/dashboard/upgrade" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>Upgrade to Pro for up to 14 buttons →</a></>
                  )}
                </div>
              </div>
            )}

            {/* Fixed: Balance */}
            {(['balance', 'referral'] as const).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', flexShrink: 0 }}>
                    /{key}
                  </code>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {key === 'balance' ? "Show user's coin balance" : 'Generate referral link, earn coins for invites'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#818cf8', background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>
                    always on
                  </span>
                </div>
                <div className="toggle-track on" style={{ opacity: 0.5, pointerEvents: 'none', flexShrink: 0 }}>
                  <div className="toggle-thumb" />
                </div>
              </div>
            ))}

            {/* Optional toggles */}
            {optionals.map(cmd => {
              const blocked = !cmd.enabled && !canAddMore
              return (
                <div key={cmd.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', flexShrink: 0 }}>
                      {cmd.label}
                    </code>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{cmd.desc}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {blocked && <Lock size={13} color='#6b7280' />}
                    <div
                      className={`toggle-track ${cmd.enabled ? 'on' : 'off'}`}
                      onClick={() => handleOptionalToggle(cmd.key, cmd.enabled)}
                      style={{ cursor: blocked ? 'not-allowed' : 'pointer' }}
                    >
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Referral reward */}
            <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <label style={labelStyle}>Referral reward (coins per invite)</label>
              <input
                type="number"
                value={referralRewardAmount}
                onChange={e => setReferralRewardAmount(Number(e.target.value))}
                className="input-field"
                style={{ maxWidth: '200px' }}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <button onClick={saveFeatures} disabled={savingFeatures} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {savingFeatures
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Saving...</>
                  : 'Save commands'}
              </button>
            </div>
          </div>

          {/* ── Auto replies ── */}
          <div style={sectionCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquareReply size={16} />
              Auto replies
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              When a user sends an exact trigger, the bot replies automatically.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Trigger text</label>
                <input
                  value={newCmd}
                  onChange={e => setNewCmd(e.target.value)}
                  placeholder="/mycommand or hello"
                  className="input-field"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Bot reply</label>
                <input
                  value={newResp}
                  onChange={e => setNewResp(e.target.value)}
                  placeholder="What the bot sends when triggered"
                  onKeyDown={e => e.key === 'Enter' && addReply()}
                  className="input-field"
                />
              </div>
            </div>

            <button
              onClick={addReply}
              disabled={adding || !newCmd.trim() || !newResp.trim()}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}
            >
              {adding ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              {adding ? 'Adding...' : 'Add auto reply'}
            </button>

            {loadingReplies ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Loading...
              </div>
            ) : replies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No auto replies yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {replies.map((cmd: any) => (
                  <div key={cmd.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', opacity: cmd.is_active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', flexShrink: 0 }}>
                        {cmd.command}
                      </code>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cmd.response_text.substring(0, 80)}{cmd.response_text.length > 80 ? '…' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleReply(cmd.id, cmd.is_active)} className="btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>
                        {cmd.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteReply(cmd.id, cmd.command)}
                        style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#FCA5A5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
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
                    <input
                      value={wishTitle}
                      onChange={e => setWishTitle(e.target.value)}
                      className="input-field"
                      placeholder="e.g. Daily quiz game"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Description (optional)</label>
                    <input
                      value={wishDesc}
                      onChange={e => setWishDesc(e.target.value)}
                      className="input-field"
                      placeholder="Describe how it would work..."
                      onKeyDown={e => e.key === 'Enter' && submitWish()}
                    />
                  </div>
                </div>
                <button
                  onClick={submitWish}
                  disabled={addingWish || !wishTitle.trim()}
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
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
                      {w.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{w.description}</div>
                      )}
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
