'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (authData?.user) {
        const { error: insertError } = await supabase.from('users').upsert(
          {
            id: authData.user.id,
            email: authData.user.email || email,
            full_name: fullName,
            password_hash: 'supabase_auth',
            role: 'creator',
            plan: 'free'
          },
          { onConflict: 'id' }
        )

        if (insertError) {
          setError(insertError.message)
          setLoading(false)
          return
        }
      }

      window.location.href = '/dashboard'
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'fixed', top: '-20%', right: '-5%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', bottom: '-20%', left: '-5%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div
        style={{
          flex: 1, display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px',
          position: 'relative',
          borderRight: '1px solid var(--border)'
        }}
        className="left-panel"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'var(--blue-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(59,130,246,0.4)'
          }}>
            <Bot size={22} color="white" />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>1-TouchBot</span>
        </div>
        <h1 style={{
          fontSize: '48px', fontWeight: '700', lineHeight: 1.1,
          color: 'var(--text-primary)', marginBottom: '20px',
          letterSpacing: '-0.02em'
        }}>
          Launch your<br />
          <span style={{ background: 'var(--blue-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            bot business.
          </span>
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '400px' }}>
          Create your account and start building Telegram bots with powerful monetization and automation tools.
        </p>
      </div>

      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeUp 0.4s ease-out' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '40px', justifyContent: 'center'
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--blue-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59,130,246,0.4)'
            }}>
              <Bot size={18} color="white" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: '700' }}>1-TouchBot</span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '36px',
            backdropFilter: 'blur(12px)'
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-primary)' }}>
              Create account
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
              Start building with 1-TouchBot
            </p>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '12px',
                fontSize: '13px', color: '#FCA5A5',
                marginBottom: '20px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Your full name"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Your password"
                    className="input-field"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm password"
                    className="input-field"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? 'Creating account...' : <><span>Create account</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <a href="/login" style={{ color: 'var(--blue-primary)', textDecoration: 'none', fontWeight: '500' }}>
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .left-panel { display: flex !important; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

