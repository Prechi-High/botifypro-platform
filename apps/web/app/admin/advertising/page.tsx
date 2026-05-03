'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, RefreshCw, Search } from 'lucide-react'

type Tab = 'all' | 'pending' | 'impressions'

export default function AdminAdvertisingPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [tab, setTab] = useState<Tab>('all')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [impressions, setImpressions] = useState<any>({ total: 0, today: 0, byStatus: {} })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  async function load() {
    setLoading(true)
    try {
      let query = supabase.from('ad_campaigns')
        .select('id, title, message, budget_usd, spent_usd, target_audience_count, impressions_count, activity_window, status, approved_at, created_at, users(email)')
        .order('created_at', { ascending: false }).limit(200)

      if (tab === 'pending') query = query.eq('status', 'pending_approval')

      const { data } = await query
      setCampaigns(data || [])

      if (tab === 'impressions') {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0)
        const [{ count: total }, { count: today }] = await Promise.all([
          supabase.from('ad_impressions').select('*', { count:'exact', head:true }),
          supabase.from('ad_impressions').select('*', { count:'exact', head:true }).gte('served_at', todayStart.toISOString()),
        ])
        setImpressions({ total: total||0, today: today||0 })
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function action(id: string, endpoint: string) {
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'} })
      const data = await res.json()
      if (data.success) { notify(`Campaign ${endpoint}d`); load() }
      else notify(data.error||'Failed', false)
    } catch { notify('Request failed', false) }
  }

  const filtered = campaigns.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (c.title||'').toLowerCase().includes(s) || (c.users?.email||'').toLowerCase().includes(s)
  })

  const statusColor: Record<string,string> = { pending_approval:'#FBBF24', active:'#34D399', paused:'#60A5FA', completed:'#94a3b8', rejected:'#FCA5A5' }
  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>{toast.msg}</div>}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
            <Megaphone size={20} /> Advertising
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>{filtered.length} campaigns</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {([['all','All Campaigns'],['pending','Pending Approval'],['impressions','Impressions']] as [Tab,string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${tab===k?'rgba(57,255,20,0.4)':'rgba(255,255,255,0.08)'}`, background:tab===k?'rgba(57,255,20,0.1)':'transparent', color:tab===k?'var(--accent)':'var(--text-secondary)', fontSize:'13px', fontWeight:tab===k?600:400, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'impressions' ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {[['Total Impressions', impressions.total.toLocaleString()], ['Served Today', impressions.today.toLocaleString()]].map(([l,v])=>(
            <div key={l} style={card}>
              <div style={{ fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.1em', marginBottom:'8px' }}>{l}</div>
              <div style={{ fontSize:'28px', fontWeight:800, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif" }}>{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title or advertiser email..." className="input-field" style={{ paddingLeft:'36px' }} />
          </div>

          <div style={card}>
            {loading ? <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} /> :
            filtered.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No campaigns found</div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {filtered.map(c=>(
                  <div key={c.id} style={{ padding:'14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)', marginBottom:'4px' }}>{c.title}</div>
                        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'6px' }}>{c.users?.email} · {c.activity_window} window</div>
                        <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:'var(--text-secondary)', flexWrap:'wrap' }}>
                          <span>Budget: <b style={{color:'var(--text-primary)'}}>${Number(c.budget_usd).toFixed(2)}</b></span>
                          <span>Spent: <b style={{color:'var(--text-primary)'}}>${Number(c.spent_usd).toFixed(2)}</b></span>
                          <span>Impressions: <b style={{color:'var(--text-primary)'}}>{c.impressions_count}/{c.target_audience_count}</b></span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ marginTop:'8px', height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(100,(c.impressions_count/Math.max(1,c.target_audience_count))*100)}%`, background:'var(--accent)', borderRadius:'2px' }} />
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px', flexShrink:0 }}>
                        <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'4px', background:`${statusColor[c.status]||'#94a3b8'}22`, color:statusColor[c.status]||'#94a3b8' }}>{c.status.replace('_',' ').toUpperCase()}</span>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {c.status === 'pending_approval' && <>
                            <button onClick={()=>action(c.id,'approve')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>Approve</button>
                            <button onClick={()=>action(c.id,'reject')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#FCA5A5', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>Reject</button>
                          </>}
                          {c.status === 'active' && <button onClick={()=>action(c.id,'pause')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.08)', color:'#FBBF24', fontSize:'11px', cursor:'pointer' }}>Pause</button>}
                          {c.status === 'paused' && <button onClick={()=>action(c.id,'resume')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'11px', cursor:'pointer' }}>Resume</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
