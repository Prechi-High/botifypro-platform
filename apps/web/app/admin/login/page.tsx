'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid password')
      router.push('/admin')
    } catch (e: any) {
      setError(e.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #040804 0%, #060C06 100%)',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(57,255,20,0.15)',
        borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 0 60px rgba(57,255,20,0.05)',
      }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #39FF14, transparent)' }} />
        <div style={{ padding: '32px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: '24px',
            }}>🛡️</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 6px', fontFamily: "'Space Grotesk', sans-serif" }}>
              Admin Panel
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: 'Inter, sans-serif' }}>
              Enter your admin password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: '6px', fontFamily: 'Inter, sans-serif' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                autoFocus
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '13px', color: '#FCA5A5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
