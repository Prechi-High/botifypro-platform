'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data?.user) { window.location.href = '/dashboard'; return }
      setError('Login failed'); setLoading(false)
    } catch (err: any) {
      setError('Something went wrong'); setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f1f5f9'}}>
      <div style={{background:'white',padding:'2rem',borderRadius:'12px',width:'100%',maxWidth:'380px',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <h1 style={{fontSize:'1.4rem',fontWeight:'600',color:'#1e293b',marginBottom:'0.25rem'}}>Welcome back</h1>
        <p style={{color:'#94a3b8',fontSize:'0.85rem',marginBottom:'1.5rem'}}>Sign in to BotifyPro</p>
        {error && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',padding:'0.75rem',marginBottom:'1rem',color:'#dc2626',fontSize:'0.85rem'}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:'1rem'}}>
            <label style={{display:'block',fontSize:'0.85rem',fontWeight:'500',color:'#374151',marginBottom:'0.35rem'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" style={{width:'100%',padding:'0.6rem 0.75rem',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div style={{marginBottom:'1.25rem'}}>
            <label style={{display:'block',fontSize:'0.85rem',fontWeight:'500',color:'#374151',marginBottom:'0.35rem'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password" style={{width:'100%',padding:'0.6rem 0.75rem',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'0.875rem',outline:'none',boxSizing:'border-box'}} />
          </div>
          <button type="submit" disabled={loading} style={{width:'100%',padding:'0.7rem',background:loading?'#93c5fd':'#2563eb',color:'white',border:'none',borderRadius:'8px',fontSize:'0.875rem',fontWeight:'500',cursor:loading?'not-allowed':'pointer'}}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{textAlign:'center',marginTop:'1rem',fontSize:'0.85rem',color:'#94a3b8'}}>No account? <a href="/signup" style={{color:'#2563eb',fontWeight:'500',textDecoration:'none'}}>Sign up</a></p>
      </div>
    </div>
  )
}

