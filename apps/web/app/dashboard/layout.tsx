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
  { icon: Megaphone,       label: 'Advertise', href: '/dashboard/advertise' },
  { icon: Zap,             label: 'PRO',       href: '/dashboard/upgrade' },
]

const ADMIN_NAV = { icon: Shield, label: 'Admin', href: '/dashboard/admin' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false)
  const [mobile, setMobile]   = useState(false)
  const [email, setEmail]     = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme]     = useState<'dark' | 'light'>('dark')
  const pathname              = usePathname()
  const supabase              = createClient()

  // Load saved theme on mount
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
      const userEmail = user?.email || ''
      if (cancelled) return
      if (userEmail) setEmail(userEmail)

      if (!user?.id) { setIsAdmin(false); return }

      const { data: profile } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', user.id)
        .single()

      if (cancelled) return
      const profileEmail = String(profile?.email || userEmail).toLowerCase()
      setIsAdmin(profile?.role === 'admin' || profileEmail === adminEmail)
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
      background: 'linear-gradient(180deg, #050A0E 0%, #071014 50%, #050A0E 100%)',
      borderRight: '1px solid rgba(20,241,217,0.1)',
      boxShadow: 'inset -1px 0 0 rgba(20,241,217,0.05)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <img
          src="/platform-logo.png"
          alt="1-TouchBot"
          style={{ width: '140px', height: 'auto', display: 'block' }}
        />
        {mobile && (
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
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
                padding: '10px 14px', borderRadius: '10px', textDecoration: 'none',
                background: active ? 'rgba(20,241,217,0.1)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '14px', fontWeight: active ? '600' : '400',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'var(--transition)',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              <Icon size={18} color={active ? 'var(--accent)' : 'var(--text-secondary)'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={14} color="var(--accent)" />}
            </a>
          )
        })}
      </nav>

      {/* Bottom: theme toggle + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
            {isDark ? <Moon size={15} color="var(--accent)" /> : <Sun size={15} color="var(--accent)" />}
            {isDark ? 'Dark mode' : 'Light mode'}
          </div>
          <button
            onClick={toggleTheme}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
            title="Toggle theme"
          >
            <div style={{
              width: '40px', height: '22px', borderRadius: '999px',
              background: isDark ? 'var(--accent)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              position: 'relative',
              transition: 'var(--transition)',
              boxShadow: isDark ? '0 0 8px var(--accent-glow)' : 'none',
            }}>
              <div style={{
                position: 'absolute', top: '2px',
                left: isDark ? '20px' : '2px',
                width: '16px', height: '16px',
                borderRadius: '50%', background: 'white',
                transition: 'var(--transition)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isDark
                  ? <Moon size={9} color="#0B0F14" />
                  : <Sun size={9} color="#D97706" />
                }
              </div>
            </div>
          </button>
        </div>

        {/* Email */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
          {email || 'Loading...'}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '9px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'var(--transition)',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.background = 'rgba(239,68,68,0.08)'
            btn.style.borderColor = 'rgba(239,68,68,0.3)'
            btn.style.color = '#FCA5A5'
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.background = 'transparent'
            btn.style.borderColor = 'var(--border)'
            btn.style.color = 'var(--text-secondary)'
          }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Desktop sidebar */}
      {!mobile && (
        <div style={{ width: '240px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100, overflowY: 'auto' }}>
          <Sidebar />
        </div>
      )}

      {/* Mobile overlay */}
      {mobile && open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }} />
      )}

      {/* Mobile sidebar */}
      {mobile && (
        <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '240px', zIndex: 300, overflowY: 'auto', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: mobile ? 0 : '240px', display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

        {/* Mobile top bar */}
        {mobile && (
          <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'grid', gridTemplateColumns: '32px 1fr 32px', alignItems: 'center' }}>
            <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <Menu size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/platform-logo.png" alt="1-TouchBot" style={{ width: '130px', height: 'auto', display: 'block' }} />
            </div>
            {/* Theme toggle on mobile top bar */}
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {isDark ? <Sun size={20} color="var(--accent)" /> : <Moon size={20} color="var(--accent)" />}
            </button>
          </div>
        )}

        <main style={{ flex: 1, padding: mobile ? '16px' : '28px', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
