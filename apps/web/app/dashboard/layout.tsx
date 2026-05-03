'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, LayoutDashboard, Megaphone,
  LogOut, Menu, X, ChevronRight, Zap, Shield,
  Sun, Moon
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Bot,             label: 'My Bots',   href: '/dashboard/bots' },
  { icon: Zap,             label: 'PRO',       href: '/dashboard/upgrade' },
]
const ADMIN_NAV = { icon: Shield, label: 'Admin', href: '/dashboard/admin' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false)
  const [mobile, setMobile]   = useState(false)
  const [email, setEmail]     = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')
  const [theme, setTheme]     = useState<'dark' | 'light'>('dark')
  const pathname              = usePathname()
  const supabase              = createClient()

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } catch {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch {}
  }

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    let cancelled = false
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@1-touchbot.com').toLowerCase()
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user
      if (cancelled) return
      if (user?.email) setEmail(user.email)
      if (!user?.id) { setIsAdmin(false); return }
      const { data: profile } = await supabase.from('users').select('role, email, plan').eq('id', user.id).single()
      if (cancelled) return
      const pe = String(profile?.email || user.email || '').toLowerCase()
      setIsAdmin(profile?.role === 'admin' || pe === adminEmail)
      setUserPlan(profile?.plan === 'pro' ? 'pro' : 'free')
    })
    return () => { cancelled = true }
  }, [])

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isDark = theme === 'dark'

  const Sidebar = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: isDark
        ? 'linear-gradient(180deg, #040804 0%, #060C06 40%, #040804 100%)'
        : 'linear-gradient(180deg, #F0F7F0 0%, #FFFFFF 100%)',
      borderRight: `1px solid ${isDark ? 'rgba(57,255,20,0.1)' : 'rgba(0,100,0,0.1)'}`,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${isDark ? 'rgba(57,255,20,0.08)' : 'rgba(0,100,0,0.08)'}`,
      }}>
        <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '138px', height: 'auto' }} />
        {mobile && (
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
        {[...NAV, ...(isAdmin ? [ADMIN_NAV] : [])].map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={() => mobile && setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', textDecoration: 'none',
                background: active
                  ? isDark ? 'rgba(57,255,20,0.1)' : 'rgba(26,140,0,0.1)'
                  : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.01em',
                borderLeft: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = isDark ? 'rgba(57,255,20,0.05)' : 'rgba(26,140,0,0.05)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              <Icon size={17} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={13} color="var(--accent)" />}
            </a>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${isDark ? 'rgba(57,255,20,0.08)' : 'rgba(0,100,0,0.08)'}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: isDark ? 'rgba(57,255,20,0.05)' : 'rgba(26,140,0,0.05)', border: `1px solid ${isDark ? 'rgba(57,255,20,0.1)' : 'rgba(26,140,0,0.1)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
            {isDark ? <Moon size={14} color="var(--accent)" /> : <Sun size={14} color="var(--accent)" />}
            {isDark ? 'Dark' : 'Light'}
          </div>
          <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}>
            <div style={{ width: '38px', height: '20px', borderRadius: '999px', background: isDark ? 'var(--accent)' : 'var(--bg-elevated)', border: `1px solid ${isDark ? 'transparent' : 'var(--border)'}`, position: 'relative', transition: 'var(--transition)', boxShadow: isDark ? '0 0 8px var(--accent-glow)' : 'none' }}>
              <div style={{ position: 'absolute', top: '2px', left: isDark ? '19px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: isDark ? '#050A05' : 'white', transition: 'var(--transition)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </button>
        </div>

        {/* Email + Plan */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', flex: 1, minWidth: 0 }}>
            {email || '—'}
          </div>
          <span style={{
            flexShrink: 0, marginLeft: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
            padding: '2px 7px', borderRadius: '999px',
            background: userPlan === 'pro' ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${userPlan === 'pro' ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.12)'}`,
            color: userPlan === 'pro' ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {userPlan === 'pro' ? 'PRO' : 'FREE'}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', background: 'transparent', border: `1px solid ${isDark ? 'rgba(57,255,20,0.12)' : 'rgba(0,100,0,0.12)'}`, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, cursor: 'pointer', transition: 'var(--transition)' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(239,68,68,0.08)'; b.style.borderColor = 'rgba(239,68,68,0.3)'; b.style.color = '#FCA5A5' }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.borderColor = isDark ? 'rgba(57,255,20,0.12)' : 'rgba(0,100,0,0.12)'; b.style.color = 'var(--text-secondary)' }}
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
      {/* Desktop sidebar */}
      {!mobile && (
        <div style={{ width: '232px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100, overflowY: 'auto' }}>
          <Sidebar />
        </div>
      )}

      {/* Mobile overlay */}
      {mobile && open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200 }} />
      )}

      {/* Mobile sidebar */}
      {mobile && (
        <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '232px', zIndex: 300, overflowY: 'auto', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
          <Sidebar />
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, marginLeft: mobile ? 0 : '232px', display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Mobile top bar */}
        {mobile && (
          <div style={{ position: 'sticky', top: 0, zIndex: 100, background: isDark ? '#040804' : '#FFFFFF', borderBottom: `1px solid ${isDark ? 'rgba(57,255,20,0.1)' : 'rgba(0,100,0,0.1)'}`, padding: '12px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 36px', alignItems: 'center' }}>
            <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <Menu size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '120px', height: 'auto' }} />
            </div>
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        )}

        <main style={{ flex: 1, padding: mobile ? '16px' : '28px 32px', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
