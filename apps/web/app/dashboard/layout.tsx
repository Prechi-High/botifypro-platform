'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import {
  Home,
  Bot,
  Megaphone,
  Settings,
  LogOut,
  BarChart2,
  Users,
  DollarSign
} from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/dashboard/bots', label: 'Bots', icon: Bot },
  { href: '/dashboard/advertise', label: 'Advertise', icon: Megaphone },
  { href: '/dashboard/admin/campaigns', label: 'Admin', icon: Settings }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-lg font-semibold">BotifyPro</div>
          <div className="text-xs text-slate-300 mt-1">Creator Dashboard</div>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ' +
                  (active ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800')
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-slate-300">
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="flex items-center gap-2 text-xs">
                <BarChart2 size={14} /> Stats
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="flex items-center gap-2 text-xs">
                <Users size={14} /> Users
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="flex items-center gap-2 text-xs">
                <DollarSign size={14} /> Ads
              </div>
            </div>
          </div>

          <Button
            onClick={logout}
            fullWidth
            variant="secondary"
            disabled={loggingOut}
            loading={loggingOut}
            loadingText="Signing out..."
          >
            <LogOut size={18} />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}

