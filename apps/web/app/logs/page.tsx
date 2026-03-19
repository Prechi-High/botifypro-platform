'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  async function fetchLogs() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setLogs(data)
    if (error) console.error('Error fetching logs:', error)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.level === filter)

  const levelColor: Record<string, string> = {
    INFO: '#2563eb',
    WARN: '#d97706',
    ERROR: '#dc2626',
    DEBUG: '#6b7280'
  }

  return (
    <div style={{padding:'2rem',fontFamily:'monospace',background:'#0f172a',minHeight:'100vh',color:'#e2e8f0'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:'1rem'}}>
        <h1 style={{fontSize:'1.25rem',fontWeight:'600',color:'#f8fafc',margin:0}}>BotifyPro — System Logs</h1>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'0.4rem 0.75rem',borderRadius:'6px',border:'1px solid #334155',background:'#1e293b',color:'#e2e8f0',fontSize:'0.8rem'}}>
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>
          <Button
            onClick={fetchLogs}
            disabled={loading}
            loading={loading}
            loadingText="Refreshing..."
            variant="primary"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading && <p style={{color:'#94a3b8'}}>Loading logs...</p>}

      {!loading && filtered.length === 0 && (
        <p style={{color:'#94a3b8'}}>No logs found. Logs appear here after bot engine activity.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.78rem'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #334155'}}>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',color:'#94a3b8',fontWeight:'500',whiteSpace:'nowrap'}}>Time</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',color:'#94a3b8',fontWeight:'500'}}>Level</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',color:'#94a3b8',fontWeight:'500'}}>Service</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',color:'#94a3b8',fontWeight:'500'}}>Message</th>
                <th style={{textAlign:'left',padding:'0.5rem 0.75rem',color:'#94a3b8',fontWeight:'500'}}>Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} style={{borderBottom:'1px solid #1e293b'}}>
                  <td style={{padding:'0.5rem 0.75rem',color:'#64748b',whiteSpace:'nowrap'}}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{padding:'0.5rem 0.75rem'}}>
                    <span style={{color:levelColor[log.level]||'#94a3b8',fontWeight:'600'}}>{log.level}</span>
                  </td>
                  <td style={{padding:'0.5rem 0.75rem',color:'#94a3b8'}}>{log.service}</td>
                  <td style={{padding:'0.5rem 0.75rem',color:'#e2e8f0'}}>{log.message}</td>
                  <td style={{padding:'0.5rem 0.75rem',color:'#64748b',maxWidth:'300px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.data || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

