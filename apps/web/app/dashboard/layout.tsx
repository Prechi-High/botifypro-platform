'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, LayoutDashboard, Plus, Megaphone,
  Settings, LogOut, Menu, X
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Bot,             label: 'My Bots',   href: '/dashboard/bots' },
  { icon: Plus,            label: 'Add Bot',   href: '/dashboard/bots/add' },
  { icon: Megaphone,       label: 'Advertise', href: '/dashboard/advertise' },
  { icon: Settings,        label: 'Settings',  href: '/dashboard/settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(false)
  const [mobile, setMobile]   = useState(false)
  const [email, setEmail]     = useState('')
  const pathname              = usePathname()
  const supabase              = createClient()

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email)
    })
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
      background: '#1e293b'
    }}>
      {/* Top — logo + close button on mobile */}
      <div style={{
        padding: '18px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={22} color="#3b82f6" />
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>BotifyPro</span>
        </div>
        {mobile && (
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
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
                padding: '10px 12px', borderRadius: '8px', textDecoration: 'none',
                background: active ? '#3b82f6' : 'transparent',
                color: active ? 'white' : '#94a3b8',
                fontSize: '14px', fontWeight: active ? '500' : '400',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#334155' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              <Icon size={18} />
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* Bottom — user + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
        <div style={{
          fontSize: '11px', color: '#64748b', marginBottom: '8px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {email || 'Loading...'}
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '9px 12px', background: '#334155', border: 'none',
            borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer'
          }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

      {/* DESKTOP sidebar — fixed left */}
      {!mobile && (
        <div style={{
          width: '240px', flexShrink: 0,
          position: 'fixed', top: 0, left: 0, height: '100vh',
          zIndex: 100, overflowY: 'auto'
        }}>
          <Sidebar />
        </div>
      )}

      {/* MOBILE overlay — dark background behind sidebar */}
      {mobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200
          }}
        />
      )}

      {/* MOBILE sidebar — slides in from left */}
      {mobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0,
          height: '100vh', width: '260px',
          zIndex: 300, overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease'
        }}>
          <Sidebar />
        </div>
      )}

      {/* MAIN content */}
      <div style={{
        flex: 1,
        marginLeft: mobile ? 0 : '240px',
        display: 'flex', flexDirection: 'column',
        minHeight: '100vh'
      }}>

        {/* MOBILE top bar with hamburger */}
        {mobile && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'white', borderBottom: '1px solid #e2e8f0',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <button
              onClick={() => setOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', color: '#374151', display: 'flex', alignItems: 'center'
              }}
            >
              <Menu size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#3b82f6" />
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>BotifyPro</span>
            </div>
          </div>
        )}

        {/* Page content */}
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
