'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type LogRow = {
  id: string
  level: string
  message: string
  data: string | null
  service: string
  created_at: string
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '24px'
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  padding: 16,
  overflowX: 'auto'
}

function levelColor(level: string) {
  if (level === 'ERROR') return '#dc2626'
  if (level === 'WARN') return '#b45309'
  if (level === 'INFO') return '#2563eb'
  if (level === 'DEBUG') return '#6b7280'
  return '#334155'
}

export default function LogsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [level, setLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL')
  const [logs, setLogs] = useState<LogRow[]>([])

  async function ensureAuth() {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      window.location.href = '/login'
      return false
    }
    return true
  }

  async function fetchLogs(selectedLevel: typeof level) {
    setLoading(true)
    setError('')
    try {
      const ok = await ensureAuth()
      if (!ok) return

      const res = await fetch('/api/logs' + (selectedLevel !== 'ALL' ? `?level=${selectedLevel}` : ''), {
        method: 'GET'
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || 'Failed to load logs')
      }
      const data = (await res.json()) as LogRow[]
      setLogs(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>BotifyPro — System Logs</h1>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>Last 200 logs (newest first)</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
              style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', fontSize: 14 }}
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            <button
              onClick={() => fetchLogs(level)}
              disabled={loading}
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: loading ? '#f1f5f9' : '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, color: '#dc2626', fontSize: 14, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#334155' }}>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Time</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>Level</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>Service</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>Message</th>
                <th style={{ padding: '10px 8px', borderBottom: '1px solid #e5e7eb' }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: levelColor(row.level) }}>
                    {row.level}
                  </td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>{row.service}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>{row.message}</td>
                  <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.data || ''}</pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: '#64748b' }}>
                    No logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

