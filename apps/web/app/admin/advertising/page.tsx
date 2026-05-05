'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, RefreshCw, Search, X, Eye } from 'lucide-react'

type Tab = 'all' | 'pending' | 'impressions'

const REJECTION_REASONS = [
  'Ad content violates our terms of service',
  'Inappropriate or offensive content',
  'Misleading or false claims',
  'Prohibited product or service',
  'Low quality or unclear message',
  'Invalid or broken button URL',
  'Insufficient budget for target audience',
  'Custom reason...',
]

export default function AdminAdvertisingPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [tab, setTab] = useState<Tab>('all')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [impressions, setImpressions] = useState({ total: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  // Preview modal
  const [previewCampaign, setPreviewCampaign] = useState<any|null>(null)

  // Rejection modal
  const [rejectTarget, setRejectTarget] = useState<any|null>(null)
  const [selectedReason, setSelectedReason] = useState(REJECTION_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  async function load() {
    setLoading(true)
    try {
      let query = supabase.from('ad_campaigns')
        .select('id, title, message, image_url, button_text, button_url, budget_usd, spent_usd, target_audience_count, impressions_count, activity_window, status, rejection_reason, approved_at, created_at, users(email)')
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

  async function approve(id: string) {
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/approve`, { method:'POST', headers:{'Content-Type':'application/json'} })
      const data = await res.json()
      if (data.success) { notify('Campaign approved'); load() }
      else notify(data.error||'Failed', false)
    } catch { notify('Request failed', false) }
  }

  async function rejectWithReason() {
    if (!rejectTarget) return
    setRejecting(true)
    const reason = selectedReason === 'Custom reason...' ? customReason.trim() : selectedReason
    if (!reason) { notify('Select or enter a rejection reason', false); setRejecting(false); return }
    try {
      // Store rejection reason in DB
      await supabase.from('ad_campaigns').update({ status: 'rejected', rejection_reason: reason }).eq('id', rejectTarget.id)
      // Also call bot engine to update
      await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${rejectTarget.id}/reject`, { method:'POST', headers:{'Content-Type':'application/json'} })
      notify('Campaign rejected')
      setRejectTarget(null)
      setSelectedReason(REJECTION_REASONS[0])
      setCustomReason('')
      load()
    } catch { notify('Failed to reject', false) }
    setRejecting(false)
  }

  async function togglePause(id: string, currentStatus: string) {
    const action = currentStatus === 'paused' ? 'resume' : 'pause'
    try {
      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/campaigns/${id}/pause`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action }) })
      const data = await res.json()
      if (data.success) { notify(`Campaign ${action}d`); load() }
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
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', pointerEvents:'none' }}>{toast.msg}</div>}

      {/* Preview Modal */}
      {previewCampaign && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setPreviewCampaign(null) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ width:'100%', maxWidth:'500px', background:'#0D110D', border:'1px solid rgba(57,255,20,0.2)', borderRadius:'16px', overflow:'hidden', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin:0, fontSize:'16px', fontWeight:700, color:'#fff' }}>Ad Preview</h3>
              <button onClick={()=>setPreviewCampaign(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* Ad preview as it would appear in Telegram */}
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'14px' }}>
                <div style={{ fontSize:'11px', color:'var(--accent)', fontWeight:700, marginBottom:'8px', letterSpacing:'0.1em' }}>AD PREVIEW</div>
                {previewCampaign.image_url && <img src={previewCampaign.image_url} alt="" style={{ width:'100%', borderRadius:'8px', marginBottom:'10px', maxHeight:'200px', objectFit:'cover' }} />}
                <div style={{ fontSize:'14px', color:'var(--text-primary)', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: (previewCampaign.message||'').replace(/\n/g,'<br/>') }} />
                {previewCampaign.button_text && previewCampaign.button_url && (
                  <div style={{ marginTop:'10px' }}>
                    <a href={previewCampaign.button_url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', padding:'8px 16px', background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.3)', borderRadius:'8px', color:'var(--accent)', textDecoration:'none', fontSize:'13px', fontWeight:500 }}>
                      {previewCampaign.button_text}
                    </a>
                  </div>
                )}
              </div>
              {/* Campaign details */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {[
                  ['Advertiser', previewCampaign.users?.email||'—'],
                  ['Status', previewCampaign.status?.replace('_',' ')],
                  ['Budget', `$${Number(previewCampaign.budget_usd).toFixed(2)}`],
                  ['Spent', `$${Number(previewCampaign.spent_usd).toFixed(2)}`],
                  ['Target Audience', previewCampaign.target_audience_count?.toLocaleString()],
                  ['Impressions', `${previewCampaign.impressions_count}/${previewCampaign.target_audience_count}`],
                  ['Activity Window', previewCampaign.activity_window],
                  ['Created', new Date(previewCampaign.created_at).toLocaleDateString()],
                ].map(([l,v])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'8px 10px' }}>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'2px' }}>{l}</div>
                    <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {previewCampaign.rejection_reason && (
                <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'#FCA5A5' }}>
                  <strong>Rejection reason:</strong> {previewCampaign.rejection_reason}
                </div>
              )}
              {/* Actions */}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {previewCampaign.status === 'pending_approval' && <>
                  <button onClick={()=>{ approve(previewCampaign.id); setPreviewCampaign(null) }} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>✓ Approve</button>
                  <button onClick={()=>{ setRejectTarget(previewCampaign); setPreviewCampaign(null) }} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#FCA5A5', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>✕ Reject</button>
                </>}
                {previewCampaign.status === 'active' && <button onClick={()=>{ togglePause(previewCampaign.id, 'active'); setPreviewCampaign(null) }} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.08)', color:'#FBBF24', fontSize:'13px', cursor:'pointer' }}>Pause</button>}
                {previewCampaign.status === 'paused' && <button onClick={()=>{ togglePause(previewCampaign.id, 'paused'); setPreviewCampaign(null) }} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'13px', cursor:'pointer' }}>Resume</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectTarget && (
        <div onClick={e=>{ if(e.target===e.currentTarget){ setRejectTarget(null); setCustomReason('') } }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ width:'100%', maxWidth:'440px', background:'#0D110D', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'16px', overflow:'hidden' }}>
            <div style={{ height:'2px', background:'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <h3 style={{ margin:0, fontSize:'16px', fontWeight:700, color:'#fff' }}>Reject Campaign</h3>
                <button onClick={()=>{ setRejectTarget(null); setCustomReason('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={18}/></button>
              </div>
              <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                Rejecting: <strong style={{ color:'var(--text-primary)' }}>{rejectTarget.title}</strong>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'8px' }}>Select rejection reason:</label>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {REJECTION_REASONS.map(r=>(
                    <button key={r} onClick={()=>setSelectedReason(r)} style={{ padding:'9px 12px', borderRadius:'8px', border:`1px solid ${selectedReason===r?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`, background:selectedReason===r?'rgba(239,68,68,0.08)':'transparent', color:selectedReason===r?'#FCA5A5':'var(--text-secondary)', fontSize:'13px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {selectedReason === 'Custom reason...' && (
                <div>
                  <label style={{ display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'6px' }}>Custom reason:</label>
                  <textarea value={customReason} onChange={e=>setCustomReason(e.target.value)} className="input-field" style={{ minHeight:'80px', resize:'vertical' }} placeholder="Enter your reason..." />
                </div>
              )}
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={()=>{ setRejectTarget(null); setCustomReason('') }} className="btn-ghost" style={{ flex:1 }}>Cancel</button>
                <button onClick={rejectWithReason} disabled={rejecting} style={{ flex:1, padding:'10px', borderRadius:'8px', border:'none', background:'#ef4444', color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                  {rejecting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                        <div style={{ marginTop:'8px', height:'4px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(100,(c.impressions_count/Math.max(1,c.target_audience_count))*100)}%`, background:'var(--accent)', borderRadius:'2px' }} />
                        </div>
                        {c.rejection_reason && (
                          <div style={{ marginTop:'8px', fontSize:'12px', color:'#FCA5A5', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'6px', padding:'6px 10px' }}>
                            ✕ Rejected: {c.rejection_reason}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px', flexShrink:0 }}>
                        <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'4px', background:`${statusColor[c.status]||'#94a3b8'}22`, color:statusColor[c.status]||'#94a3b8' }}>{c.status.replace('_',' ').toUpperCase()}</span>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          <button onClick={()=>setPreviewCampaign(c)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.08)', color:'#818cf8', fontSize:'11px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                            <Eye size={11} /> Preview
                          </button>
                          {c.status === 'pending_approval' && <>
                            <button onClick={()=>approve(c.id)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>Approve</button>
                            <button onClick={()=>setRejectTarget(c)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#FCA5A5', fontSize:'11px', cursor:'pointer', fontWeight:500 }}>Reject</button>
                          </>}
                          {c.status === 'active' && <button onClick={()=>togglePause(c.id,'active')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.08)', color:'#FBBF24', fontSize:'11px', cursor:'pointer' }}>Pause</button>}
                          {c.status === 'paused' && <button onClick={()=>togglePause(c.id,'paused')} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#34D399', fontSize:'11px', cursor:'pointer' }}>Resume</button>}
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
