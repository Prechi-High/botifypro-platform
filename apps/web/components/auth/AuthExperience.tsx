'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Eye, EyeOff, Sparkles, CheckCircle2, Bot, Zap, Gift, Megaphone } from 'lucide-react'

type AuthMode = 'signup' | 'login'

const PREVIEW_ITEMS = [
  { icon: <Bot size={16} />, title: 'Launch Fast', text: 'Create reward bots, referral systems, and auto flows in minutes.' },
  { icon: <Gift size={16} />, title: 'Monetize', text: 'Handle campaigns, deposits, upgrades, and user engagement from one place.' },
  { icon: <Megaphone size={16} />, title: 'Broadcast', text: 'Reach thousands of bot users instantly with smart audience targeting.' },
  { icon: <Zap size={16} />, title: 'Automate', text: 'Plug in payments, referrals, and retention mechanics without coding.' },
]

const INTRO_PRIMARY_TEXT = 'Build fully automated Telegram bots in minutes'
const INTRO_FIRST_SECONDARY = 'No coding required'
const INTRO_SECOND_SECONDARY = 'Plug and Play'

export default function AuthExperience({ initialMode }: { initialMode: AuthMode }) {
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [entryVisible, setEntryVisible] = useState(true)
  const [entryReady, setEntryReady] = useState(false)
  const [primaryVisible, setPrimaryVisible] = useState(false)
  const [secondaryText, setSecondaryText] = useState('')
  const [transitionVisible, setTransitionVisible] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('Initializing workspace')
  const [focusedField, setFocusedField] = useState<string | null>(null)

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

  const starDots = useMemo(
    () =>
      Array.from({ length: 44 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        top: `${(index * 11 + 7) % 100}%`,
        size: 1 + (index % 3),
        delay: `${(index % 9) * 0.45}s`,
        duration: `${5 + (index % 5)}s`,
        opacity: 0.25 + ((index % 6) * 0.1),
      })),
    []
  )

  const nebulaParticles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        left: `${8 + (index * 8) % 86}%`,
        top: `${12 + (index * 13) % 78}%`,
        size: 80 + (index % 4) * 36,
        delay: `${index * 0.3}s`,
        duration: `${14 + (index % 4) * 3}s`,
      })),
    []
  )

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []

    function schedule(delay: number, fn: () => void) {
      const timer = window.setTimeout(() => {
        if (!cancelled) fn()
      }, delay)
      timers.push(timer)
    }

    function typeSequence(text: string, onDone?: () => void) {
      let index = 0
      const interval = window.setInterval(() => {
        if (cancelled) {
          window.clearInterval(interval)
          return
        }
        index += 1
        setSecondaryText(text.slice(0, index))
        if (index >= text.length) {
          window.clearInterval(interval)
          onDone?.()
        }
      }, 52)
    }

    function deleteSequence(length: number, onDone?: () => void) {
      let index = length
      const interval = window.setInterval(() => {
        if (cancelled) {
          window.clearInterval(interval)
          return
        }
        index -= 1
        setSecondaryText(INTRO_FIRST_SECONDARY.slice(0, Math.max(0, index)))
        if (index <= 0) {
          window.clearInterval(interval)
          onDone?.()
        }
      }, 34)
    }

    schedule(180, () => setEntryReady(true))
    schedule(900, () => setPrimaryVisible(true))
    schedule(1600, () => {
      typeSequence(INTRO_FIRST_SECONDARY, () => {
        schedule(600, () => {
          deleteSequence(INTRO_FIRST_SECONDARY.length, () => {
            schedule(180, () => {
              typeSequence(INTRO_SECOND_SECONDARY)
            })
          })
        })
      })
    })
    schedule(6000, () => setEntryVisible(false))

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  function beginSuccessTransition(label: string) {
    setTransitionLabel(label)
    setTransitionVisible(true)
    window.setTimeout(() => {
      window.location.href = '/dashboard'
    }, 2200)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
      if (error) {
        setLoginError(error.message)
        setLoginLoading(false)
        return
      }
      if (data?.user) {
        beginSuccessTransition('Preparing your dashboard')
      }
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

      if (authError) {
        setSignupError(authError.message)
        setSignupLoading(false)
        return
      }

      if (authData?.user) {
        const { error: insertError } = await supabase.from('users').upsert(
          {
            id: authData.user.id,
            email: authData.user.email || signupEmail,
            full_name: fullName,
            password_hash: 'supabase_auth',
            role: 'creator',
            plan: 'free'
          },
          { onConflict: 'id' }
        )

        if (insertError) {
          setSignupError(insertError.message)
          setSignupLoading(false)
          return
        }
      }

      beginSuccessTransition('Launching your bot workspace')
    } catch {
      setSignupError('Something went wrong. Please try again.')
      setSignupLoading(false)
    }
  }

  const activeError = mode === 'signup' ? signupError : loginError

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#030712',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 20%, rgba(37,99,235,0.18), transparent 24%), radial-gradient(circle at 15% 80%, rgba(59,130,246,0.12), transparent 26%), radial-gradient(circle at 88% 18%, rgba(99,102,241,0.16), transparent 28%), linear-gradient(180deg, #020617 0%, #030712 50%, #020617 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-8%',
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.08) 1px, transparent 1.4px)',
            backgroundSize: '180px 180px',
            opacity: 0.18,
            animation: 'starDrift 26s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '-10%',
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.04) 1px, transparent 1.2px)',
            backgroundSize: '110px 110px',
            opacity: 0.14,
            animation: 'starDriftSlow 38s linear infinite',
          }}
        />
        {starDots.map((star) => (
          <span
            key={star.id}
            style={{
              position: 'absolute',
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              opacity: star.opacity,
              boxShadow: '0 0 8px rgba(255,255,255,0.6)',
              animation: `starPulse ${star.duration} ease-in-out ${star.delay} infinite`,
            }}
          />
        ))}
        {nebulaParticles.map((particle) => (
          <span
            key={particle.id}
            style={{
              position: 'absolute',
              left: particle.left,
              top: particle.top,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: particle.id % 2 === 0
                ? 'radial-gradient(circle, rgba(96,165,250,0.12), transparent 68%)'
                : 'radial-gradient(circle, rgba(129,140,248,0.1), transparent 70%)',
              filter: 'blur(10px)',
              animation: `nebulaFloat ${particle.duration} ease-in-out ${particle.delay} infinite`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(2,6,23,0.2) 0%, rgba(2,6,23,0.62) 40%, rgba(2,6,23,0.9) 100%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '1280px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            padding: '20px 16px 28px',
            alignItems: 'center',
          }}
          className="auth-shell"
        >
          <section
            style={{
              display: 'none',
              position: 'relative',
              padding: '48px 48px 48px 32px',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '24px',
            }}
            className="auth-copy"
          >
            <div
              style={{
                width: 'fit-content',
                animation: 'logoFloat 4.8s ease-in-out infinite',
                filter: 'drop-shadow(0 0 30px rgba(56,189,248,0.22))',
              }}
            >
              <img
                src="/platform-logo.png"
                alt="1-TouchBot"
                style={{ width: '280px', maxWidth: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  width: 'fit-content',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <Sparkles size={14} color="#60a5fa" />
                Space-powered Telegram bot onboarding
              </div>

              <h1
                style={{
                  fontSize: 'clamp(36px, 5vw, 64px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.04em',
                  fontWeight: 800,
                  color: '#f8fafc',
                }}
              >
                Build, automate, and monetize your Telegram bots faster.
              </h1>

              <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'rgba(226,232,240,0.8)', maxWidth: '480px' }}>
                1-TouchBot gives creators a polished control center for referrals, rewards, payments, campaigns, and broadcasts without the engineering overhead.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                maxWidth: '520px',
              }}
              className="desktop-feature-grid"
            >
              {PREVIEW_ITEMS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: '16px',
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 10px 40px rgba(2,6,23,0.22)',
                  }}
                >
                  <div style={{ color: '#60a5fa', marginBottom: '10px' }}>{item.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.55, color: 'rgba(203,213,225,0.78)' }}>{item.text}</div>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                position: 'relative',
                opacity: entryVisible ? 0.1 : 1,
                transform: entryVisible ? 'translateY(18px) scale(0.985)' : 'translateY(0) scale(1)',
                transition: 'opacity 0.45s ease, transform 0.55s ease',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  borderRadius: '30px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.7), rgba(15,23,42,0.56))',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 24px 100px rgba(2,6,23,0.55)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(96,165,250,0.16), transparent 36%, rgba(129,140,248,0.12) 72%, transparent)',
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ position: 'relative', padding: '22px 22px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                    <div
                      style={{
                        width: 'fit-content',
                        animation: 'logoFloat 4.8s ease-in-out infinite',
                        filter: 'drop-shadow(0 0 26px rgba(56,189,248,0.18))',
                      }}
                    >
                      <img
                        src="/platform-logo.png"
                        alt="1-TouchBot"
                        style={{ width: '190px', maxWidth: '100%', height: 'auto', display: 'block' }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      padding: '5px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      marginBottom: '22px',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '5px',
                        bottom: '5px',
                        left: mode === 'signup' ? '5px' : 'calc(50% + 1px)',
                        width: 'calc(50% - 6px)',
                        borderRadius: '999px',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(99,102,241,0.95))',
                        boxShadow: '0 10px 28px rgba(37,99,235,0.28)',
                        transition: 'left 0.32s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: mode === 'signup' ? '#ffffff' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: mode === 'login' ? '#ffffff' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      Sign in
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '18px',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px', letterSpacing: '-0.03em' }}>
                        {mode === 'signup' ? 'Create account' : 'Welcome back'}
                      </h2>
                      <p style={{ fontSize: '14px', color: 'rgba(203,213,225,0.78)', lineHeight: 1.55 }}>
                        {mode === 'signup'
                          ? 'Create your workspace and start building Telegram bot automations.'
                          : 'Sign in to continue managing campaigns, wallets, and bot growth.'}
                      </p>
                    </div>
                    <div
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '999px',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        color: '#86efac',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                      className="trust-pill"
                    >
                      <CheckCircle2 size={14} />
                      Secure auth
                    </div>
                  </div>

                  {activeError && (
                    <div
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.28)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        fontSize: '13px',
                        color: '#fecaca',
                        marginBottom: '18px',
                      }}
                    >
                      {activeError}
                    </div>
                  )}

                  <div key={mode} style={{ animation: 'authSwap 0.34s ease' }}>
                    {mode === 'signup' ? (
                      <form onSubmit={handleSignup}>
                        <Field label="Full Name" active={!!fullName || focusedField === 'signup-name'}>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            onFocus={() => setFocusedField('signup-name')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder=""
                            className="input-field auth-input"
                          />
                        </Field>

                        <Field label="Email address" active={!!signupEmail || focusedField === 'signup-email'}>
                          <input
                            type="email"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            onFocus={() => setFocusedField('signup-email')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder=""
                            className="input-field auth-input"
                          />
                        </Field>

                        <Field label="Password" active={!!signupPassword || focusedField === 'signup-password'}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showSignupPass ? 'text' : 'password'}
                              value={signupPassword}
                              onChange={(e) => setSignupPassword(e.target.value)}
                              onFocus={() => setFocusedField('signup-password')}
                              onBlur={() => setFocusedField(null)}
                              required
                              placeholder=""
                              className="input-field auth-input"
                              style={{ paddingRight: '46px' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignupPass(!showSignupPass)}
                              style={iconButtonStyle}
                            >
                              {showSignupPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </Field>

                        <Field label="Confirm Password" active={!!confirmPassword || focusedField === 'signup-confirm'}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showConfirmPass ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              onFocus={() => setFocusedField('signup-confirm')}
                              onBlur={() => setFocusedField(null)}
                              required
                              placeholder=""
                              className="input-field auth-input"
                              style={{ paddingRight: '46px' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPass(!showConfirmPass)}
                              style={iconButtonStyle}
                            >
                              {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </Field>

                        <button
                          type="submit"
                          disabled={signupLoading}
                          className="btn-primary auth-cta"
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            marginTop: '6px',
                          }}
                        >
                          {signupLoading ? 'Creating account...' : <><span>Create account</span><ArrowRight size={16} /></>}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleLogin}>
                        <Field label="Email address" active={!!loginEmail || focusedField === 'login-email'}>
                          <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            onFocus={() => setFocusedField('login-email')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder=""
                            className="input-field auth-input"
                          />
                        </Field>

                        <Field label="Password" active={!!loginPassword || focusedField === 'login-password'}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={loginShowPass ? 'text' : 'password'}
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              onFocus={() => setFocusedField('login-password')}
                              onBlur={() => setFocusedField(null)}
                              required
                              placeholder=""
                              className="input-field auth-input"
                              style={{ paddingRight: '46px' }}
                            />
                            <button
                              type="button"
                              onClick={() => setLoginShowPass(!loginShowPass)}
                              style={iconButtonStyle}
                            >
                              {loginShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </Field>

                        <button
                          type="submit"
                          disabled={loginLoading}
                          className="btn-primary auth-cta"
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            marginTop: '6px',
                          }}
                        >
                          {loginLoading ? 'Signing in...' : <><span>Sign in</span><ArrowRight size={16} /></>}
                        </button>
                      </form>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      color: '#94a3b8',
                      fontSize: '13px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{mode === 'signup' ? 'Already have an account?' : 'No account yet?'}</span>
                    <button
                      type="button"
                      onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#60a5fa',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {mode === 'signup' ? 'Sign in' : 'Create one free'}
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: '18px',
                      display: 'flex',
                      gap: '10px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                      scrollSnapType: 'x proximity',
                    }}
                  >
                    {PREVIEW_ITEMS.slice(0, 3).map((item) => (
                      <div
                        key={item.title}
                        style={{
                          minWidth: '160px',
                          flex: '0 0 160px',
                          scrollSnapAlign: 'start',
                          borderRadius: '18px',
                          padding: '14px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <div style={{ color: '#60a5fa', marginBottom: '8px' }}>{item.icon}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(203,213,225,0.72)' }}>{item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {entryVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(180deg, rgba(2,6,23,0.18), rgba(2,6,23,0.72))',
            backdropFilter: 'blur(6px)',
            opacity: entryVisible ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        >
          <div style={{ maxWidth: '760px', textAlign: 'center' }}>
            <div
              style={{
                width: 'fit-content',
                margin: '0 auto 18px',
                transform: entryReady ? 'scale(1)' : 'scale(0.8)',
                opacity: entryReady ? 1 : 0,
                transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1), opacity 0.8s ease',
                animation: 'logoFloat 4.6s ease-in-out infinite',
                filter: 'drop-shadow(0 0 34px rgba(56,189,248,0.28))',
              }}
            >
              <img
                src="/platform-logo.png"
                alt="1-TouchBot"
                style={{ width: '220px', maxWidth: '70vw', height: 'auto', display: 'block' }}
              />
            </div>

            <div
              style={{
                fontSize: 'clamp(28px, 4.8vw, 54px)',
                lineHeight: 1.04,
                fontWeight: 800,
                letterSpacing: '-0.045em',
                color: '#f8fafc',
                textShadow: '0 12px 44px rgba(15,23,42,0.45)',
                opacity: primaryVisible ? 1 : 0,
                transform: primaryVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            >
              {INTRO_PRIMARY_TEXT}
            </div>

            <div
              style={{
                minHeight: '36px',
                marginTop: '16px',
                fontSize: 'clamp(18px, 2.6vw, 28px)',
                color: '#93c5fd',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {secondaryText}
              <span style={{ opacity: 0.8, marginLeft: '2px' }}>|</span>
            </div>
          </div>
        </div>
      )}

      {transitionVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(180deg, rgba(2,6,23,0.48), rgba(2,6,23,0.86))',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 'fit-content',
                margin: '0 auto 18px',
                animation: 'logoFloat 3.6s ease-in-out infinite',
                filter: 'drop-shadow(0 0 34px rgba(56,189,248,0.28))',
              }}
            >
              <img
                src="/platform-logo.png"
                alt="1-TouchBot"
                style={{ width: '200px', maxWidth: '70vw', height: 'auto', display: 'block' }}
              />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px', letterSpacing: '-0.03em' }}>
              {transitionLabel}
            </div>
            <div style={{ fontSize: '13px', color: '#93c5fd' }}>
              Securing session and opening your dashboard...
            </div>
          </div>
        </div>
      )}

      <style>{`
        .auth-input {
          background: rgba(255,255,255,0.035);
          border-color: rgba(255,255,255,0.12);
          padding: 18px 14px 10px;
          border-radius: 16px;
          font-size: 14px;
          transform: scale(1);
        }
        .auth-input:hover {
          border-color: rgba(148,163,184,0.24);
        }
        .auth-input:focus {
          border-color: rgba(96,165,250,0.9);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.14), 0 0 24px rgba(59,130,246,0.16);
          transform: scale(1.01);
        }
        .auth-cta {
          background-size: 200% 200%;
          animation: ctaFlow 5s ease infinite, ctaPulse 2.6s ease-in-out infinite;
        }
        @keyframes authSwap {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctaFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(59,130,246,0.28); }
          50% { box-shadow: 0 0 36px rgba(99,102,241,0.4); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes starDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-22px, 16px, 0); }
        }
        @keyframes starDriftSlow {
          from { transform: translate3d(0, 0, 0) scale(1.02); }
          to { transform: translate3d(18px, -20px, 0) scale(1.06); }
        }
        @keyframes starPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes nebulaFloat {
          0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.72; }
          50% { transform: translate3d(12px, -16px, 0); opacity: 1; }
        }
        @media (min-width: 980px) {
          .auth-shell {
            grid-template-columns: minmax(0, 1.08fr) minmax(420px, 470px);
            gap: 24px;
            padding: 28px 28px 32px;
          }
          .auth-copy {
            display: flex !important;
          }
          .trust-pill {
            display: inline-flex !important;
          }
        }
        @media (max-width: 640px) {
          .desktop-feature-grid {
            display: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-cta,
          .auth-input,
          .desktop-feature-grid,
          .trust-pill {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  active,
  children,
}: {
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative', marginBottom: '14px' }}>
      <div style={{ position: 'relative' }}>
        {children}
        <label
          style={{
            position: 'absolute',
            left: '14px',
            top: active ? '8px' : '15px',
            fontSize: active ? '11px' : '13px',
            color: active ? '#93c5fd' : '#94a3b8',
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
            fontWeight: 600,
          }}
        >
          {label}
        </label>
      </div>
    </div>
  )
}

const iconButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
}
