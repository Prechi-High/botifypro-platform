'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, EyeOff, ArrowRight, ChevronRight,
  Bot, Coins, Users, Trophy, ArrowDownToLine, ArrowUpFromLine, Megaphone, Rocket
} from 'lucide-react'

type AuthMode = 'signup' | 'login'

// ── Onboarding slides — all icons from lucide-react ───────────────────────────
const SLIDES = [
  {
    id: 0,
    headline: 'Build Telegram Bots in Seconds',
    sub: 'No coding. Just automation.',
    Visual: () => (
      <div style={{ position: 'relative', width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(20,241,217,0.12)', border: '1.5px solid rgba(20,241,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(20,241,217,0.18)', animation: 'floatY 3s ease-in-out infinite' }}>
          <Bot size={36} color="#14F1D9" />
        </div>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ position: 'absolute', width: '4px', height: '4px', borderRadius: '50%', background: '#14F1D9', opacity: 0.4 + (i % 3) * 0.2, left: `${15 + i * 13}%`, top: `${20 + (i % 3) * 25}%`, animation: `starPulse ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
        ))}
      </div>
    ),
  },
  {
    id: 1,
    headline: 'Automate Everything',
    sub: 'Rewards · Referrals · Leaderboards',
    Visual: () => (
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', padding: '16px 0' }}>
        {[
          { Icon: Coins,  label: 'Rewards',     color: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.3)',  iconColor: '#FBBF24' },
          { Icon: Users,  label: 'Referrals',   color: 'rgba(20,241,217,0.12)',  border: 'rgba(20,241,217,0.3)',  iconColor: '#14F1D9' },
          { Icon: Trophy, label: 'Leaderboard', color: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', iconColor: '#A78BFA' },
        ].map(({ Icon, label, color, border, iconColor }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: `floatY ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: color, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={24} color={iconColor} />
            </div>
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>{label}</span>
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
      <div style={{ position: 'relative', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        {[
          { Icon: ArrowDownToLine, label: 'Deposit',   color: '#14F1D9' },
          { Icon: ArrowUpFromLine, label: 'Withdraw',  color: '#60A5FA' },
          { Icon: Megaphone,       label: 'Broadcast', color: '#A78BFA' },
        ].map(({ Icon, label, color }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(20,241,217,0.06)', border: '1px solid rgba(20,241,217,0.15)', animation: `floatY ${2.2 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` }}>
            <Icon size={20} color={color} />
            <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{label}</span>
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
        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,241,217,0.2), rgba(20,241,217,0.04))', border: '2px solid rgba(20,241,217,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(20,241,217,0.2)', animation: 'floatY 3s ease-in-out infinite' }}>
          <Rocket size={36} color="#14F1D9" />
        </div>
      </div>
    ),
  },
]

export default function AuthExperience({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // ── Onboarding state ────────────────────────────────────────────────────────
  const [slide, setSlide] = useState(0)
  const [showAuth, setShowAuth] = useState(false)
  const touchStartX = useRef<number | null>(null)

  // ── Auth state (unchanged logic) ────────────────────────────────────────────
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [focusedField, setFocusedField] = useState<string | null>(null)
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

  // ── Swipe handlers ──────────────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextSlide()
      else prevSlide()
    }
    touchStartX.current = null
  }
  function nextSlide() {
    if (slide < SLIDES.length - 1) setSlide(s => s + 1)
    else enterAuth()
  }
  function prevSlide() {
    if (slide > 0) setSlide(s => s - 1)
  }
  function enterAuth() {
    setShowAuth(true)
  }

  // ── Auth logic (unchanged) ──────────────────────────────────────────────────
  function beginSuccessTransition(label: string) {
    setTransitionLabel(label)
    setTransitionVisible(true)
    window.setTimeout(() => {
      window.location.href = '/dashboard'
    }, 1500)
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
    if (signupPassword !== confirmPassword) {
      setSignupError('Passwords do not match')
      setSignupLoading(false)
      return
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { data: { full_name: fullName } }
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
  const currentSlide = SLIDES[slide]

  // ── Stars ───────────────────────────────────────────────────────────────────
  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${(i * 19) % 100}%`,
    top: `${(i * 13 + 5) % 100}%`,
    size: 1 + (i % 2),
    delay: `${(i % 8) * 0.5}s`,
    dur: `${4 + (i % 4)}s`,
    op: 0.2 + (i % 5) * 0.1,
  })), [])

  return (
    <div
      style={{ minHeight: '100vh', background: '#0B0F14', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Background ── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(20,241,217,0.06), transparent)' }} />
        {stars.map(s => (
          <span key={s.id} style={{ position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: '50%', background: '#fff', opacity: s.op, animation: `starPulse ${s.dur} ease-in-out ${s.delay} infinite` }} />
        ))}
      </div>

      {/* ── Skip button ── */}
      {!showAuth && (
        <button
          onClick={enterAuth}
          style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', padding: '6px 14px', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          Skip
        </button>
      )}

      {/* ── Onboarding ── */}
      {!showAuth && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ marginBottom: '32px', animation: 'floatY 4s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(20,241,217,0.2))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '160px', height: 'auto' }} />
          </div>

          {/* Slide content */}
          <div
            key={slide}
            style={{ width: '100%', maxWidth: '360px', textAlign: 'center', animation: 'slideIn 0.28s ease' }}
          >
            {currentSlide.Visual && <currentSlide.Visual />}

            <h1 style={{ fontFamily: '"Sora", sans-serif', fontSize: '26px', fontWeight: 700, color: '#E5E7EB', lineHeight: 1.2, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>
              {currentSlide.headline}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6, margin: 0 }}>
              {currentSlide.sub}
            </p>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => i < SLIDES.length - 1 ? setSlide(i) : enterAuth()}
                style={{ width: i === slide ? '24px' : '8px', height: '8px', borderRadius: '999px', background: i === slide ? '#14F1D9' : 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', transition: 'all 0.25s ease', padding: 0 }}
              />
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: '28px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {slide === SLIDES.length - 1 ? (
              <button
                onClick={enterAuth}
                style={{ width: '100%', padding: '15px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #14F1D9, #0ea5e9)', color: '#0B0F14', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 30px rgba(20,241,217,0.3)', animation: 'glowPulse 2.5s ease-in-out infinite' }}
              >
                Get Started <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={nextSlide}
                style={{ width: '100%', padding: '15px', borderRadius: '14px', border: '1.5px solid rgba(20,241,217,0.4)', background: 'rgba(20,241,217,0.06)', color: '#14F1D9', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Auth card ── */}
      {showAuth && (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', position: 'relative', zIndex: 2, animation: 'slideUp 0.35s cubic-bezier(0.22,1,0.36,1)' }}
        >
          {/* Logo */}
          <div style={{ marginBottom: '24px', animation: 'floatY 4s ease-in-out infinite', filter: 'drop-shadow(0 0 16px rgba(20,241,217,0.18))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '140px', height: 'auto' }} />
          </div>

          <div style={{ width: '100%', maxWidth: '420px', borderRadius: '24px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(20,241,217,0.15)', backdropFilter: 'blur(20px)', boxShadow: '0 0 60px rgba(20,241,217,0.06), 0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {/* Teal glow top */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #14F1D9, transparent)' }} />

            <div style={{ padding: '24px 22px 28px' }}>
              {/* Toggle */}
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
                <div style={{ position: 'absolute', top: '4px', bottom: '4px', left: mode === 'signup' ? '4px' : 'calc(50% + 1px)', width: 'calc(50% - 5px)', borderRadius: '999px', background: 'linear-gradient(135deg, #14F1D9, #0ea5e9)', transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 16px rgba(20,241,217,0.3)' }} />
                <button type="button" onClick={() => setMode('signup')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'signup' ? '#0B0F14' : '#9CA3AF', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'color 0.2s' }}>
                  Create account
                </button>
                <button type="button" onClick={() => setMode('login')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'login' ? '#0B0F14' : '#9CA3AF', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'color 0.2s' }}>
                  Sign in
                </button>
              </div>

              {/* Heading */}
              <h2 style={{ fontFamily: '"Sora", sans-serif', fontSize: '22px', fontWeight: 700, color: '#E5E7EB', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px', lineHeight: 1.5 }}>
                {mode === 'signup' ? 'Start building Telegram bots for free.' : 'Sign in to your workspace.'}
              </p>

              {/* Error */}
              {activeError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '11px 14px', fontSize: '13px', color: '#FCA5A5', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
                  {activeError}
                </div>
              )}

              {/* Forms */}
              <div key={mode} style={{ animation: 'authSwap 0.28s ease' }}>
                {mode === 'signup' ? (
                  <form onSubmit={handleSignup}>
                    <FloatField label="Full Name" value={fullName} focused={focusedField === 'signup-name'}>
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} onFocus={() => setFocusedField('signup-name')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" />
                    </FloatField>
                    <FloatField label="Email address" value={signupEmail} focused={focusedField === 'signup-email'}>
                      <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} onFocus={() => setFocusedField('signup-email')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" />
                    </FloatField>
                    <FloatField label="Password" value={signupPassword} focused={focusedField === 'signup-password'}>
                      <div style={{ position: 'relative' }}>
                        <input type={showSignupPass ? 'text' : 'password'} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} onFocus={() => setFocusedField('signup-password')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowSignupPass(!showSignupPass)} style={eyeBtn}>{showSignupPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </FloatField>
                    <FloatField label="Confirm Password" value={confirmPassword} focused={focusedField === 'signup-confirm'}>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onFocus={() => setFocusedField('signup-confirm')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} style={eyeBtn}>{showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </FloatField>
                    <button type="submit" disabled={signupLoading} className="teal-cta">
                      {signupLoading ? 'Creating account...' : <><span>Start Building Instantly</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin}>
                    <FloatField label="Email address" value={loginEmail} focused={focusedField === 'login-email'}>
                      <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onFocus={() => setFocusedField('login-email')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" />
                    </FloatField>
                    <FloatField label="Password" value={loginPassword} focused={focusedField === 'login-password'}>
                      <div style={{ position: 'relative' }}>
                        <input type={loginShowPass ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onFocus={() => setFocusedField('login-password')} onBlur={() => setFocusedField(null)} required placeholder="" className="teal-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setLoginShowPass(!loginShowPass)} style={eyeBtn}>{loginShowPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </FloatField>
                    <button type="submit" disabled={loginLoading} className="teal-cta">
                      {loginLoading ? 'Signing in...' : <><span>Start Building Instantly</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                )}
              </div>

              {/* Switch mode */}
              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                {mode === 'signup' ? 'Already have an account? ' : 'No account yet? '}
                <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} style={{ border: 'none', background: 'transparent', color: '#14F1D9', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                  {mode === 'signup' ? 'Sign in' : 'Create one free'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Success transition ── */}
      {transitionVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,15,20,0.92)', backdropFilter: 'blur(12px)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', animation: 'floatY 3s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(20,241,217,0.3))' }}>
              <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '160px', height: 'auto' }} />
            </div>
            <div style={{ fontFamily: '"Sora", sans-serif', fontSize: '20px', fontWeight: 700, color: '#E5E7EB', marginBottom: '6px' }}>{transitionLabel}</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#14F1D9' }}>Securing session and opening your dashboard...</div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .teal-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 22px 14px 8px;
          font-size: 14px;
          color: #E5E7EB;
          font-family: Inter, sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
        }
        .teal-input:hover { border-color: rgba(20,241,217,0.25); }
        .teal-input:focus {
          border-color: #14F1D9;
          box-shadow: 0 0 0 3px rgba(20,241,217,0.12), 0 0 20px rgba(20,241,217,0.1);
          transform: scale(1.01);
        }
        .teal-cta {
          width: 100%;
          margin-top: 8px;
          padding: 14px 18px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #14F1D9 0%, #0ea5e9 50%, #14F1D9 100%);
          background-size: 200% 200%;
          color: #0B0F14;
          font-size: 15px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          animation: ctaFlow 4s ease infinite, glowPulse 2.5s ease-in-out infinite;
          transition: transform 0.15s, opacity 0.15s;
        }
        .teal-cta:hover { transform: scale(1.02); }
        .teal-cta:active { transform: scale(0.98); }
        .teal-cta:disabled { opacity: 0.6; cursor: not-allowed; animation: none; }

        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes starPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.4); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSwap {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctaFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(20,241,217,0.25); }
          50% { box-shadow: 0 0 36px rgba(20,241,217,0.45); }
        }
        @media (prefers-reduced-motion: reduce) {
          .teal-cta, .teal-input { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── Floating label field ──────────────────────────────────────────────────────
function FloatField({ label, value, focused, children }: { label: string; value: string; focused: boolean; children: React.ReactNode }) {
  const active = !!value || focused
  return (
    <div style={{ position: 'relative', marginBottom: '14px' }}>
      {children}
      <label style={{ position: 'absolute', left: '14px', top: active ? '7px' : '15px', fontSize: active ? '10px' : '13px', color: active ? '#14F1D9' : '#6B7280', pointerEvents: 'none', transition: 'all 0.18s ease', fontWeight: 600, fontFamily: 'Inter, sans-serif', letterSpacing: active ? '0.04em' : '0' }}>
        {label}
      </label>
    </div>
  )
}

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280',
  display: 'flex', alignItems: 'center', padding: 0,
}
