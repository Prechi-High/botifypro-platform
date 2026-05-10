'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, EyeOff, ArrowRight, ChevronRight,
  Bot, Coins, Users, Trophy, ArrowDownToLine, ArrowUpFromLine, Megaphone, Rocket,
  Zap, Clock, Calendar
} from 'lucide-react'

type AuthMode = 'signup' | 'login'

// ── Onboarding slides ─────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 0,
    headline: 'Build Telegram Bots in Seconds',
    sub: 'No coding. Just automation.',
    Visual: () => (
      <div style={{ position: 'relative', width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '88px', height: '88px', borderRadius: '20px', background: 'var(--accent-glow-lg)', border: '1.5px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px var(--accent-glow)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Bot size={40} color="var(--accent)" />
        </div>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ position: 'absolute', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.3 + (i % 3) * 0.2, left: `${12 + i * 14}%`, top: `${18 + (i % 3) * 26}%`, animation: `authPulse ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
        ))}
      </div>
    ),
  },
  {
    id: 1,
    headline: 'Automate Everything',
    sub: 'Rewards · Referrals · Leaderboards',
    Visual: () => (
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', padding: '16px 0' }}>
        {[
          { Icon: Coins,  label: 'Rewards' },
          { Icon: Users,  label: 'Referrals' },
          { Icon: Trophy, label: 'Leaderboard' },
        ].map(({ Icon, label }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: `authFloat ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '14px', background: 'var(--accent-glow-lg)', border: '1.5px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={26} color="var(--accent)" />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 2,
    headline: 'Built-in Payments & Growth',
    sub: 'Deposit · Withdraw · Broadcast',
    Visual: () => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '140px' }}>
        {[
          { Icon: ArrowDownToLine, label: 'Deposit' },
          { Icon: ArrowUpFromLine, label: 'Withdraw' },
          { Icon: Megaphone,       label: 'Broadcast' },
        ].map(({ Icon, label }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 12px', borderRadius: '12px', background: 'var(--accent-glow-lg)', border: '1px solid var(--border)', animation: `authFloat ${2.2 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` }}>
            <Icon size={22} color="var(--accent)" />
            <span style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 3,
    headline: 'Start Building Now',
    sub: 'Join thousands of bot creators',
    Visual: () => (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--accent-glow-lg)', border: '2px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-green-lg)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Rocket size={40} color="var(--accent)" />
        </div>
      </div>
    ),
  },
]

// ── Advertiser-specific onboarding slides ─────────────────────────────────────
const ADVERTISER_SLIDES = [
  {
    id: 0,
    headline: 'Reach Millions of Users',
    sub: 'Tap into an engaged network of active Telegram bot users across every niche.',
    Visual: () => (
      <div style={{ position: 'relative', width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'var(--accent-glow-lg)', border: '1.5px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px var(--accent-glow)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Users size={40} color="var(--accent)" />
        </div>
        {[0,1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{ position: 'absolute', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.2 + (i % 4) * 0.15, left: `${8 + i * 12}%`, top: `${15 + (i % 4) * 20}%`, animation: `authPulse ${1.8 + i * 0.3}s ease-in-out ${i * 0.25}s infinite` }} />
        ))}
      </div>
    ),
  },
  {
    id: 1,
    headline: 'Target Any Category',
    sub: 'Choose your audience by activity window — reach the hottest users in the last 24h or re-engage users from the past 7 days.',
    Visual: () => (
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', padding: '12px 0', flexWrap: 'wrap' }}>
        {[
          { Icon: Zap,      label: '24h Active',  color: 'var(--accent)' },
          { Icon: Clock,    label: '48h Window',  color: '#60A5FA' },
          { Icon: Calendar, label: '7d Window',   color: '#A78BFA' },
        ].map(({ Icon, label, color }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 16px', borderRadius: '12px', background: 'var(--accent-glow-lg)', border: '1px solid var(--border)', animation: `authFloat ${2.4 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`, minWidth: '80px' }}>
            <Icon size={24} color={color} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 2,
    headline: 'Bigger Budget, Bigger Savings',
    sub: 'The more you spend, the more audience you unlock. Volume discounts apply automatically on large campaigns.',
    Visual: () => (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--accent-glow-lg)', border: '1.5px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px var(--accent-glow)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Coins size={36} color="var(--accent)" />
        </div>
      </div>
    ),
  },
  {
    id: 3,
    headline: 'Launch Your First Campaign',
    sub: 'Set your budget, pick your audience, upload your creative — go live in minutes.',
    Visual: () => (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--accent-glow-lg)', border: '2px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-green-lg)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Megaphone size={40} color="var(--accent)" />
        </div>
      </div>
    ),
  },
]

export default function AuthExperience({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [slide, setSlide] = useState(0)
  const [showAuth, setShowAuth] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [transitionVisible, setTransitionVisible] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('Initializing workspace')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPass, setLoginShowPass] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [fullName, setFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showSignupPass, setShowSignupPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')

  useEffect(() => { setMode(initialMode) }, [initialMode])

  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard'
    const params = new URLSearchParams(window.location.search)
    const r = params.get('redirect')
    return r && r.startsWith('/dashboard') ? r : '/dashboard'
  }, [])

  const isAdvertiserFlow = redirectTo === '/dashboard/advertise'
  const activeSlides = isAdvertiserFlow ? ADVERTISER_SLIDES : SLIDES

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) { dx < 0 ? nextSlide() : prevSlide() }
    touchStartX.current = null
  }
  function nextSlide() { slide < activeSlides.length - 1 ? setSlide(s => s + 1) : enterAuth() }
  function prevSlide() { if (slide > 0) setSlide(s => s - 1) }
  function enterAuth() { setShowAuth(true) }

  function beginSuccessTransition(label: string) {
    setTransitionLabel(label)
    setTransitionVisible(true)
    window.setTimeout(() => { window.location.href = redirectTo }, 1500)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
      if (error) { setLoginError(error.message); setLoginLoading(false); return }
      if (data?.user) beginSuccessTransition('Preparing your dashboard')
    } catch {
      setLoginError('Something went wrong')
      setLoginLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSignupLoading(true)
    setSignupError('')
    if (signupPassword !== confirmPassword) { setSignupError('Passwords do not match'); setSignupLoading(false); return }
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail, password: signupPassword, options: { data: { full_name: fullName } }
      })
      if (authError) { setSignupError(authError.message); setSignupLoading(false); return }
      if (authData?.user) {
        const { error: insertError } = await supabase.from('users').upsert(
          { id: authData.user.id, email: authData.user.email || signupEmail, full_name: fullName, password_hash: 'supabase_auth', role: 'creator', plan: 'free' },
          { onConflict: 'id' }
        )
        if (insertError) { setSignupError(insertError.message); setSignupLoading(false); return }
      }
      beginSuccessTransition('Launching your bot workspace')
    } catch {
      setSignupError('Something went wrong. Please try again.')
      setSignupLoading(false)
    }
  }

  const activeError = mode === 'signup' ? signupError : loginError
  const currentSlide = activeSlides[slide]

  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i, left: `${(i * 19) % 100}%`, top: `${(i * 13 + 5) % 100}%`,
    size: 1 + (i % 2), delay: `${(i % 8) * 0.5}s`, dur: `${4 + (i % 4)}s`, op: 0.15 + (i % 4) * 0.08,
  })), [])

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background — grid mesh + stars */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div className="mesh-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, var(--accent-glow-lg) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        {stars.map(s => (
          <span key={s.id} style={{ position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: '50%', background: 'var(--accent)', opacity: s.op, animation: `authPulse ${s.dur} ease-in-out ${s.delay} infinite` }} />
        ))}
      </div>

      {/* Skip */}
      {!showAuth && (
        <button
          onClick={enterAuth}
          className="btn-ghost"
          style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, padding: '7px 16px', fontSize: '12px' }}
        >
          Skip
        </button>
      )}

      {/* ── ONBOARDING ── */}
      {!showAuth && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', position: 'relative', zIndex: 2 }}>
          <div style={{ marginBottom: '36px', animation: 'authFloat 4s ease-in-out infinite', filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '150px', height: 'auto' }} />
          </div>

          <div key={slide} style={{ width: '100%', maxWidth: '360px', textAlign: 'center', animation: 'authSlideIn 0.25s ease' }}>
            <currentSlide.Visual />
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, margin: '18px 0 8px', letterSpacing: '-0.02em' }}>
              {currentSlide.headline}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              {currentSlide.sub}
            </p>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
            {activeSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => i < activeSlides.length - 1 ? setSlide(i) : enterAuth()}
                style={{ width: i === slide ? '28px' : '8px', height: '8px', borderRadius: '999px', background: i === slide ? 'var(--accent)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'all 0.25s ease', padding: 0, boxShadow: i === slide ? '0 0 8px var(--accent-glow)' : 'none' }}
              />
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: '28px', width: '100%', maxWidth: '360px' }}>
            {slide === activeSlides.length - 1 ? (
              <button
                onClick={enterAuth}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', animation: 'authGlow 2.5s ease-in-out infinite' }}
              >
                {isAdvertiserFlow ? 'Start Advertising' : 'Get Started'} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={nextSlide}
                className="btn-ghost"
                style={{ width: '100%', padding: '13px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── AUTH CARD ── */}
      {showAuth && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', zIndex: 2, animation: 'authSlideUp 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ marginBottom: '28px', animation: 'authFloat 4s ease-in-out infinite', filter: 'drop-shadow(0 0 16px var(--accent-glow))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '130px', height: 'auto' }} />
          </div>

          <div className="glass" style={{ width: '100%', maxWidth: '420px', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: 'var(--accent-gradient)' }} />

            <div style={{ padding: '26px 24px 30px' }}>
              {/* Mode toggle */}
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px', borderRadius: '8px', background: 'var(--accent-glow-lg)', border: '1px solid var(--border)', marginBottom: '26px' }}>
                <div style={{ position: 'absolute', top: '4px', bottom: '4px', left: mode === 'signup' ? '4px' : 'calc(50% + 1px)', width: 'calc(50% - 5px)', borderRadius: '6px', background: 'var(--accent)', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 16px var(--accent-glow)' }} />
                <button type="button" onClick={() => setMode('signup')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'signup' ? '#050A05' : 'var(--text-muted)', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                  Create Account
                </button>
                <button type="button" onClick={() => setMode('login')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'login' ? '#050A05' : 'var(--text-muted)', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                  Sign In
                </button>
              </div>

              <h2 style={{ margin: '0 0 4px' }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 22px', fontFamily: 'Inter, sans-serif' }}>
                {mode === 'signup' ? 'Start building Telegram bots for free.' : 'Sign in to your workspace.'}
              </p>

              {activeError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: '13px', color: '#FCA5A5', marginBottom: '18px', fontFamily: 'Inter, sans-serif' }}>
                  {activeError}
                </div>
              )}

              <div key={mode} style={{ animation: 'authSwap 0.25s ease' }}>
                {mode === 'signup' ? (
                  <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <AuthField label="Full Name">
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Your name" className="input-field" />
                    </AuthField>
                    <AuthField label="Email Address">
                      <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required placeholder="you@example.com" className="input-field" />
                    </AuthField>
                    <AuthField label="Password">
                      <div style={{ position: 'relative' }}>
                        <input type={showSignupPass ? 'text' : 'password'} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required placeholder="••••••••" className="input-field" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowSignupPass(!showSignupPass)} style={eyeBtn}>{showSignupPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <AuthField label="Confirm Password">
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="input-field" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} style={eyeBtn}>{showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <button type="submit" disabled={signupLoading} className="btn-primary" style={{ width: '100%', padding: '13px', marginTop: '4px' }}>
                      {signupLoading ? 'Creating account...' : <><span>Start Building Instantly</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <AuthField label="Email Address">
                      <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="you@example.com" className="input-field" />
                    </AuthField>
                    <AuthField label="Password">
                      <div style={{ position: 'relative' }}>
                        <input type={loginShowPass ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••" className="input-field" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setLoginShowPass(!loginShowPass)} style={eyeBtn}>{loginShowPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <button type="submit" disabled={loginLoading} className="btn-primary" style={{ width: '100%', padding: '13px', marginTop: '4px' }}>
                      {loginLoading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                )}
              </div>

              <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                {mode === 'signup' ? 'Already have an account? ' : 'No account yet? '}
                <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}>
                  {mode === 'signup' ? 'Sign In' : 'Create one free'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS TRANSITION ── */}
      {transitionVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,10,8,0.95)', backdropFilter: 'blur(12px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '20px', animation: 'authFloat 3s ease-in-out infinite', filter: 'drop-shadow(0 0 24px var(--accent-glow))' }}>
              <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '150px', height: 'auto' }} />
            </div>
            <h2 style={{ margin: '0 0 8px' }}>{transitionLabel}</h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--accent)' }}>
              {redirectTo === '/dashboard/advertise' ? 'Taking you to the advertising platform...' : 'Securing session and opening your dashboard...'}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes authFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes authPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.5); }
        }
        @keyframes authSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes authSlideUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSwap {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authGlow {
          0%, 100% { box-shadow: 0 0 20px var(--accent-glow); }
          50% { box-shadow: var(--shadow-green); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── Standard label + input field ─────────────────────────────────────────────
function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', padding: 0,
}
