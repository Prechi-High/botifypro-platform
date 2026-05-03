'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Bot, ArrowUpDown, Megaphone,
  TrendingUp, ScrollText, Radio, Settings, List,
  LogOut, Menu, X, ChevronRight, Shield
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Overview',         href: '/admin' },
  { icon: Users,           label: 'Users',            href: '/admin/users' },
  { icon: Bot,             label: 'Bots',             href: '/admin/bots' },
  { icon: ArrowUpDown,     label: 'Transactions',     href: '/admin/transactions' },
  { icon: Megaphone,       label: 'Advertising',      href: '/admin/advertising' },
  { icon: TrendingUp,      label: 'Revenue',          href: '/admin/revenue' },
  { icon: ScrollText,      label: 'System Logs',      href: '/admin/logs' },
  { icon: Radio,           label: 'Broadcast',        href: '/admin/broadcast' },
  { icon: Settings,        label: 'Platform Settings',href: '/admin/settings' },
  { icon: List,            label: 'Command Wishlist', href: '/admin/wishlist' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const Sidebar = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #040804 0%, #060C06 40%, #040804 100%)',
      borderRight: '1px solid rgba(57,255,20,0.1)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(57,255,20,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Admin Panel</div>
            <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>BOTIFYPRO</div>
          </div>
        </div>
        {mobile && (
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={() => mobile && setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', textDecoration: 'none',
                background: active ? 'rgba(57,255,20,0.1)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: active ? 700 : 500,
                borderLeft: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(57,255,20,0.05)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              <Icon size={15} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={12} color="var(--accent)" />}
            </a>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(57,255,20,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', padding: '0 2px' }}>
          Logged in as Admin
        </div>
        <button
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(57,255,20,0.12)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(239,68,68,0.08)'; b.style.borderColor = 'rgba(239,68,68,0.3)'; b.style.color = '#FCA5A5' }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.borderColor = 'rgba(57,255,20,0.12)'; b.style.color = 'var(--text-secondary)' }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      {!mobile && (
        <div style={{ width: '220px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100, overflowY: 'auto' }}>
          <Sidebar />
        </div>
      )}

      {/* Mobile overlay */}
      {mobile && open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200 }} />
      )}

      {/* Mobile sidebar */}
      {mobile && (
        <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '220px', zIndex: 300, overflowY: 'auto', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.22s ease' }}>
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: mobile ? 0 : '220px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Mobile top bar */}
        {mobile && (
          <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#040804', borderBottom: '1px solid rgba(57,255,20,0.1)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <Menu size={22} />
            </button>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Admin Panel</div>
          </div>
        )}

        <div style={{ flex: 1, padding: '24px 20px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
