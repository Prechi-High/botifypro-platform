'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data?.user) { window.location.href = '/dashboard' }
    } catch { setError('Something went wrong'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient glows */}
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

      {/* Left panel — branding */}
      <div style={{
        flex: 1, display: 'none',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        position: 'relative',
        borderRight: '1px solid var(--border)'
      }}
      className="left-panel">
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '48px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'var(--blue-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(59,130,246,0.4)'
          }}>
            <Bot size={22} color="white" />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
            1-TouchBot
          </span>
        </div>
        <h1 style={{
          fontSize: '48px', fontWeight: '700', lineHeight: 1.1,
          color: 'var(--text-primary)', marginBottom: '20px',
          letterSpacing: '-0.02em'
        }}>
          Build powerful<br />
          <span style={{ background: 'var(--blue-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Telegram bots.
          </span>
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '400px' }}>
          The professional platform for creating, managing, and scaling Telegram bots. No code required.
        </p>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{
          width: '100%', maxWidth: '400px',
          animation: 'fadeUp 0.4s ease-out'
        }}>
          {/* Logo for mobile */}
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
            <h2 style={{
              fontSize: '22px', fontWeight: '600',
              marginBottom: '6px', color: 'var(--text-primary)'
            }}>Welcome back</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
              Sign in to your account
            </p>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '12px',
                fontSize: '13px', color: '#FCA5A5',
                marginBottom: '20px'
              }}>{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>Email address</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required placeholder="you@example.com"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required placeholder="Your password"
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

              <button
                type="submit" disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? 'Signing in...' : <><span>Sign in</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <p style={{
              textAlign: 'center', marginTop: '20px',
              fontSize: '13px', color: 'var(--text-muted)'
            }}>
              No account?{' '}
              <a href="/signup" style={{ color: 'var(--blue-primary)', fontWeight: '500', textDecoration: 'none' }}>
                Create one free
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

