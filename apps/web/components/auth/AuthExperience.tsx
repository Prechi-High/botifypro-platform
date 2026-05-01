'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, EyeOff, ArrowRight, ChevronRight,
  Bot, Coins, Users, Trophy, ArrowDownToLine, ArrowUpFromLine, Megaphone, Rocket
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
        <div style={{ width: '88px', height: '88px', borderRadius: '20px', background: 'rgba(57,255,20,0.08)', border: '1.5px solid rgba(57,255,20,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(57,255,20,0.15)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Bot size={40} color="#39FF14" />
        </div>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ position: 'absolute', width: '4px', height: '4px', borderRadius: '50%', background: '#39FF14', opacity: 0.3 + (i % 3) * 0.2, left: `${12 + i * 14}%`, top: `${18 + (i % 3) * 26}%`, animation: `authPulse ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }} />
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
          { Icon: Coins,  label: 'Rewards',     bg: 'rgba(57,255,20,0.08)',  border: 'rgba(57,255,20,0.25)',  color: '#39FF14' },
          { Icon: Users,  label: 'Referrals',   bg: 'rgba(57,255,20,0.06)',  border: 'rgba(57,255,20,0.2)',   color: '#39FF14' },
          { Icon: Trophy, label: 'Leaderboard', bg: 'rgba(57,255,20,0.04)',  border: 'rgba(57,255,20,0.15)',  color: '#39FF14' },
        ].map(({ Icon, label, bg, border, color }, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: `authFloat ${2.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '14px', background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={26} color={color} />
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(57,255,20,0.7)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
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
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 12px', borderRadius: '12px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', animation: `authFloat ${2.2 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` }}>
            <Icon size={22} color="#39FF14" />
            <span style={{ fontSize: '10px', color: 'rgba(57,255,20,0.7)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
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
        <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(57,255,20,0.08)', border: '2px solid rgba(57,255,20,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(57,255,20,0.15)', animation: 'authFloat 3s ease-in-out infinite' }}>
          <Rocket size={40} color="#39FF14" />
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

  // ── Auth state (logic unchanged) ────────────────────────────────────────────
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

  // Read ?redirect= param — if user came from /dashboard/advertise, go back there after login
  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard'
    const params = new URLSearchParams(window.location.search)
    const r = params.get('redirect')
    return r && r.startsWith('/dashboard') ? r : '/dashboard'
  }, [])

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) { dx < 0 ? nextSlide() : prevSlide() }
    touchStartX.current = null
  }
  function nextSlide() { slide < SLIDES.length - 1 ? setSlide(s => s + 1) : enterAuth() }
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
  const currentSlide = SLIDES[slide]

  // Stars
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i, left: `${(i * 19) % 100}%`, top: `${(i * 13 + 5) % 100}%`,
    size: 1 + (i % 2), delay: `${(i % 8) * 0.5}s`, dur: `${4 + (i % 4)}s`, op: 0.15 + (i % 4) * 0.08,
  })), [])

  return (
    <div
      style={{ minHeight: '100vh', background: '#080A08', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background — grid mesh + stars */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Grid mesh */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(57,255,20,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Green glow top */}
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(57,255,20,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        {/* Stars */}
        {stars.map(s => (
          <span key={s.id} style={{ position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: '50%', background: '#39FF14', opacity: s.op, animation: `authPulse ${s.dur} ease-in-out ${s.delay} infinite` }} />
        ))}
      </div>

      {/* Skip */}
      {!showAuth && (
        <button
          onClick={enterAuth}
          style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '6px', padding: '7px 16px', color: 'rgba(57,255,20,0.8)', fontSize: '12px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Skip
        </button>
      )}

      {/* ── ONBOARDING ── */}
      {!showAuth && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ marginBottom: '36px', animation: 'authFloat 4s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(57,255,20,0.2))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '150px', height: 'auto' }} />
          </div>

          {/* Slide */}
          <div key={slide} style={{ width: '100%', maxWidth: '360px', textAlign: 'center', animation: 'authSlideIn 0.25s ease' }}>
            <currentSlide.Visual />
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15, margin: '18px 0 8px', letterSpacing: '-0.02em' }}>
              {currentSlide.headline}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
              {currentSlide.sub}
            </p>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => i < SLIDES.length - 1 ? setSlide(i) : enterAuth()}
                style={{ width: i === slide ? '28px' : '8px', height: '8px', borderRadius: '999px', background: i === slide ? '#39FF14' : 'rgba(57,255,20,0.2)', border: 'none', cursor: 'pointer', transition: 'all 0.25s ease', padding: 0, boxShadow: i === slide ? '0 0 8px rgba(57,255,20,0.5)' : 'none' }}
              />
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: '28px', width: '100%', maxWidth: '360px' }}>
            {slide === SLIDES.length - 1 ? (
              <button
                onClick={enterAuth}
                style={{ width: '100%', padding: '14px', borderRadius: '6px', border: 'none', background: '#39FF14', color: '#050A05', fontSize: '14px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 28px rgba(57,255,20,0.35)', animation: 'authGlow 2.5s ease-in-out infinite' }}
              >
                Get Started <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={nextSlide}
                style={{ width: '100%', padding: '13px', borderRadius: '6px', border: '1.5px solid rgba(57,255,20,0.4)', background: 'rgba(57,255,20,0.06)', color: '#39FF14', fontSize: '14px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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
          {/* Logo */}
          <div style={{ marginBottom: '28px', animation: 'authFloat 4s ease-in-out infinite', filter: 'drop-shadow(0 0 16px rgba(57,255,20,0.2))' }}>
            <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '130px', height: 'auto' }} />
          </div>

          <div style={{ width: '100%', maxWidth: '420px', borderRadius: '16px', background: '#0D110D', border: '1px solid rgba(57,255,20,0.15)', boxShadow: '0 0 60px rgba(57,255,20,0.06), 0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            {/* Green top bar */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #39FF14, transparent)' }} />

            <div style={{ padding: '26px 24px 30px' }}>
              {/* Mode toggle */}
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px', borderRadius: '8px', background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.12)', marginBottom: '26px' }}>
                <div style={{ position: 'absolute', top: '4px', bottom: '4px', left: mode === 'signup' ? '4px' : 'calc(50% + 1px)', width: 'calc(50% - 5px)', borderRadius: '6px', background: '#39FF14', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 16px rgba(57,255,20,0.4)' }} />
                <button type="button" onClick={() => setMode('signup')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'signup' ? '#050A05' : 'rgba(57,255,20,0.5)', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                  Create Account
                </button>
                <button type="button" onClick={() => setMode('login')} style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: mode === 'login' ? '#050A05' : 'rgba(57,255,20,0.5)', fontWeight: 700, fontSize: '13px', padding: '11px 14px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                  Sign In
                </button>
              </div>

              {/* Heading */}
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0 0 22px', lineHeight: 1.5 }}>
                {mode === 'signup' ? 'Start building Telegram bots for free.' : 'Sign in to your workspace.'}
              </p>

              {/* Error */}
              {activeError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '11px 14px', fontSize: '13px', color: '#FCA5A5', marginBottom: '18px', fontFamily: 'Inter, sans-serif' }}>
                  {activeError}
                </div>
              )}

              {/* Forms */}
              <div key={mode} style={{ animation: 'authSwap 0.25s ease' }}>
                {mode === 'signup' ? (
                  <form onSubmit={handleSignup}>
                    <AuthField label="Full Name" value={fullName} focused={focusedField === 'signup-name'}>
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} onFocus={() => setFocusedField('signup-name')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" />
                    </AuthField>
                    <AuthField label="Email address" value={signupEmail} focused={focusedField === 'signup-email'}>
                      <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} onFocus={() => setFocusedField('signup-email')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" />
                    </AuthField>
                    <AuthField label="Password" value={signupPassword} focused={focusedField === 'signup-password'}>
                      <div style={{ position: 'relative' }}>
                        <input type={showSignupPass ? 'text' : 'password'} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} onFocus={() => setFocusedField('signup-password')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowSignupPass(!showSignupPass)} style={eyeBtn}>{showSignupPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <AuthField label="Confirm Password" value={confirmPassword} focused={focusedField === 'signup-confirm'}>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onFocus={() => setFocusedField('signup-confirm')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} style={eyeBtn}>{showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <button type="submit" disabled={signupLoading} className="auth-cta">
                      {signupLoading ? 'Creating account...' : <><span>Start Building Instantly</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin}>
                    <AuthField label="Email address" value={loginEmail} focused={focusedField === 'login-email'}>
                      <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onFocus={() => setFocusedField('login-email')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" />
                    </AuthField>
                    <AuthField label="Password" value={loginPassword} focused={focusedField === 'login-password'}>
                      <div style={{ position: 'relative' }}>
                        <input type={loginShowPass ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onFocus={() => setFocusedField('login-password')} onBlur={() => setFocusedField(null)} required placeholder="" className="auth-input" style={{ paddingRight: '44px' }} />
                        <button type="button" onClick={() => setLoginShowPass(!loginShowPass)} style={eyeBtn}>{loginShowPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>
                    </AuthField>
                    <button type="submit" disabled={loginLoading} className="auth-cta">
                      {loginLoading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={16} /></>}
                    </button>
                  </form>
                )}
              </div>

              {/* Switch mode */}
              <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
                {mode === 'signup' ? 'Already have an account? ' : 'No account yet? '}
                <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} style={{ border: 'none', background: 'transparent', color: '#39FF14', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}>
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
            <div style={{ marginBottom: '20px', animation: 'authFloat 3s ease-in-out infinite', filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.3))' }}>
              <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '150px', height: 'auto' }} />
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>{transitionLabel}</h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#39FF14' }}>
              {redirectTo === '/dashboard/advertise' ? 'Taking you to the advertising platform...' : 'Securing session and opening your dashboard...'}
            </p>
          </div>
        </div>
      )}

      <style>{`
        .auth-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(57,255,20,0.04);
          border: 1.5px solid rgba(57,255,20,0.15);
          border-radius: 6px;
          padding: 22px 14px 8px;
          font-size: 14px;
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .auth-input:hover { border-color: rgba(57,255,20,0.3); }
        .auth-input:focus {
          border-color: #39FF14;
          box-shadow: 0 0 0 3px rgba(57,255,20,0.1), 0 0 16px rgba(57,255,20,0.08);
        }
        .auth-cta {
          width: 100%;
          margin-top: 8px;
          padding: 13px 18px;
          border-radius: 6px;
          border: none;
          background: #39FF14;
          color: #050A05;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 0 24px rgba(57,255,20,0.3);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          animation: authGlow 2.5s ease-in-out infinite;
        }
        .auth-cta:hover { transform: translateY(-1px); box-shadow: 0 0 36px rgba(57,255,20,0.45); }
        .auth-cta:active { transform: scale(0.97); }
        .auth-cta:disabled { opacity: 0.45; cursor: not-allowed; transform: none; animation: none; box-shadow: none; }

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
          0%, 100% { box-shadow: 0 0 20px rgba(57,255,20,0.3); }
          50% { box-shadow: 0 0 36px rgba(57,255,20,0.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-cta, .auth-input { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── Floating label field ──────────────────────────────────────────────────────
function AuthField({ label, value, focused, children }: { label: string; value: string; focused: boolean; children: React.ReactNode }) {
  const active = !!value || focused
  return (
    <div style={{ position: 'relative', marginBottom: '14px' }}>
      {children}
      <label style={{ position: 'absolute', left: '14px', top: active ? '7px' : '15px', fontSize: active ? '10px' : '13px', color: active ? '#39FF14' : 'rgba(255,255,255,0.3)', pointerEvents: 'none', transition: 'all 0.18s ease', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: active ? '0.06em' : '0', textTransform: active ? 'uppercase' : 'none' }}>
        {label}
      </label>
    </div>
  )
}

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(57,255,20,0.4)',
  display: 'flex', alignItems: 'center', padding: 0,
}
