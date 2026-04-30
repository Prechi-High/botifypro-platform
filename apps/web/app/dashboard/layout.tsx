'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/theme/ThemeToggle'
import {
  Bot, LayoutDashboard, Megaphone,
  LogOut, Menu, X, ChevronRight, Zap, Shield
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
  const pathname              = usePathname()
  const supabase              = createClient()

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

      if (!user?.id) {
        setIsAdmin(false)
        return
      }

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

  const Sidebar = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)'
    }}>
      <div style={{
        padding: '18px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/platform-logo.png"
            alt="1-TouchBot"
            style={{ width: '150px', maxWidth: '100%', height: 'auto', display: 'block' }}
          />
        </div>
        {mobile && (
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              display: 'flex',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)'
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
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
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                fontSize: '14px', fontWeight: active ? '500' : '400',
                borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)'
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              <Icon size={18} color={active ? '#3B82F6' : 'var(--text-secondary)'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={16} color="#3B82F6" />}
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-start' }}>
          <ThemeToggle />
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {email || 'Loading...'}
        </div>
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
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)'
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.background = 'var(--blue-glow)'
            btn.style.borderColor = 'var(--border-active)'
            btn.style.color = 'var(--text-primary)'
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
      <div style={{
        position: 'fixed',
        top: '-20%',
        right: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-20%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {!mobile && (
        <div style={{
          width: '240px', flexShrink: 0,
          position: 'fixed', top: 0, left: 0, height: '100vh',
          zIndex: 100, overflowY: 'auto'
        }}>
          <Sidebar />
        </div>
      )}

      {mobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200
          }}
        />
      )}

      {mobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0,
          height: '100vh', width: '240px',
          zIndex: 300, overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)'
        }}>
          <Sidebar />
        </div>
      )}

      <div style={{
        flex: 1,
        marginLeft: mobile ? 0 : '240px',
        display: 'flex', flexDirection: 'column',
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1
      }}>

        {mobile && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: '32px 1fr 40px',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'
              }}
            >
              <Menu size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/platform-logo.png"
                alt="1-TouchBot"
                style={{ width: '140px', maxWidth: '100%', height: 'auto', display: 'block' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ThemeToggle compact />
            </div>
          </div>
        )}

        <main style={{
          flex: 1,
          padding: mobile ? '16px' : '28px',
          overflowX: 'hidden'
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
