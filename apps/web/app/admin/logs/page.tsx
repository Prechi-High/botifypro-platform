'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScrollText, RefreshCw, Search } from 'lucide-react'

type Level = 'all' | 'error' | 'warn' | 'info'

export default function AdminLogsPage() {
  const supabase = createClient()
  const [level, setLevel] = useState<Level>('all')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      let query = supabase.from('logs')
        .select('id, level, message, data, service, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (level !== 'all') query = query.eq('level', level)
      const { data } = await query
      setLogs(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [level])

  const filtered = logs.filter(l => {
    if (!search) return true
    const s = search.toLowerCase()
    return (l.message||'').toLowerCase().includes(s) || (l.data||'').toLowerCase().includes(s) || (l.service||'').toLowerCase().includes(s)
  })

  const levelColor: Record<string,string> = { error:'#FCA5A5', warn:'#FBBF24', info:'#60A5FA', debug:'#94a3b8' }
  const levelBg: Record<string,string> = { error:'rgba(239,68,68,0.1)', warn:'rgba(245,158,11,0.1)', info:'rgba(59,130,246,0.1)', debug:'rgba(148,163,184,0.1)' }
  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
            <ScrollText size={20} /> System Logs
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>{filtered.length} entries</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {(['all','error','warn','info'] as Level[]).map(l=>(
          <button key={l} onClick={()=>setLevel(l)} style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${level===l?'rgba(57,255,20,0.4)':'rgba(255,255,255,0.08)'}`, background:level===l?'rgba(57,255,20,0.1)':'transparent', color:level===l?'var(--accent)':'var(--text-secondary)', fontSize:'13px', fontWeight:level===l?600:400, cursor:'pointer', textTransform:'capitalize' }}>{l === 'all' ? 'All Levels' : l.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs..." className="input-field" style={{ paddingLeft:'36px' }} />
      </div>

      <div style={card}>
        {loading ? <div className="skeleton" style={{ height:'300px', borderRadius:'8px' }} /> :
        filtered.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No logs found</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'600px', overflowY:'auto' }}>
            {filtered.map(l=>(
              <div key={l.id} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:'8px', borderLeft:`3px solid ${levelColor[l.level]||'#94a3b8'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'3px', background:levelBg[l.level]||'rgba(148,163,184,0.1)', color:levelColor[l.level]||'#94a3b8' }}>{(l.level||'').toUpperCase()}</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace' }}>{new Date(l.created_at).toLocaleString()}</span>
                  <span style={{ fontSize:'11px', color:'var(--accent)', background:'rgba(57,255,20,0.06)', padding:'1px 6px', borderRadius:'3px' }}>{l.service}</span>
                </div>
                <div style={{ fontSize:'13px', color:'var(--text-primary)', fontFamily:'monospace', wordBreak:'break-word' }}>{l.message}</div>
                {l.data && (
                  <details style={{ marginTop:'4px' }}>
                    <summary style={{ fontSize:'11px', color:'var(--text-muted)', cursor:'pointer' }}>Data</summary>
                    <pre style={{ fontSize:'11px', color:'var(--text-secondary)', background:'rgba(0,0,0,0.3)', padding:'8px', borderRadius:'6px', marginTop:'4px', overflow:'auto', maxHeight:'120px', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{typeof l.data === 'string' ? l.data : JSON.stringify(l.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
