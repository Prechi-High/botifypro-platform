'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, RefreshCw } from 'lucide-react'

type Tab = 'overview' | 'advertiser' | 'pro'

export default function AdminRevenuePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({ totalDeposits: 0, totalWithdrawn: 0, netRevenue: 0, feesCollected: 0 })
  const [advertiserDeposits, setAdvertiserDeposits] = useState<any[]>([])
  const [proRevenue, setProRevenue] = useState<any[]>([])

  async function load() {
    setLoading(true)
    try {
      if (tab === 'overview') {
        const [{ data: deposits }, { data: withdrawals }, { data: fees }] = await Promise.all([
          supabase.from('transactions').select('amount_usd').eq('type', 'deposit').eq('status', 'completed'),
          supabase.from('transactions').select('amount_usd').eq('type', 'withdrawal').eq('status', 'completed'),
          supabase.from('transactions').select('platform_fee_amount').eq('status', 'completed'),
        ])
        const totalDeposits = (deposits||[]).reduce((s:number,t:any)=>s+Number(t.amount_usd||0),0)
        const totalWithdrawn = (withdrawals||[]).reduce((s:number,t:any)=>s+Number(t.amount_usd||0),0)
        const feesCollected = (fees||[]).reduce((s:number,t:any)=>s+Number(t.platform_fee_amount||0),0)
        setOverview({ totalDeposits, totalWithdrawn, netRevenue: totalDeposits - totalWithdrawn, feesCollected })
      } else if (tab === 'advertiser') {
        const { data } = await supabase.from('advertiser_deposit_transactions')
          .select('id, amount_usd, status, gateway, gateway_tx_id, created_at, users(email)')
          .order('created_at', { ascending: false }).limit(200)
        setAdvertiserDeposits(data||[])
      } else if (tab === 'pro') {
        const { data } = await supabase.from('bot_users')
          .select('id, first_name, telegram_username, pro_deposit_amount, is_pro_member, pro_expires_at, joined_at, bots(bot_name)')
          .eq('is_pro_member', true)
          .order('joined_at', { ascending: false }).limit(200)
        setProRevenue(data||[])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
            <TrendingUp size={20} /> Revenue
          </h1>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {([['overview','Overview'],['advertiser','Advertiser Deposits'],['pro','Pro Plan Revenue']] as [Tab,string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${tab===k?'rgba(57,255,20,0.4)':'rgba(255,255,255,0.08)'}`, background:tab===k?'rgba(57,255,20,0.1)':'transparent', color:tab===k?'var(--accent)':'var(--text-secondary)', fontSize:'13px', fontWeight:tab===k?600:400, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {[
            ['TOTAL DEPOSITS', `$${overview.totalDeposits.toFixed(2)}`, '#34D399'],
            ['TOTAL WITHDRAWN', `$${overview.totalWithdrawn.toFixed(2)}`, '#FBBF24'],
            ['NET REVENUE', `$${overview.netRevenue.toFixed(2)}`, '#818CF8'],
            ['FEES COLLECTED', `$${overview.feesCollected.toFixed(2)}`, '#60A5FA'],
          ].map(([l,v,c])=>(
            <div key={l} style={card}>
              <div style={{ fontSize:'10px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.1em', marginBottom:'8px' }}>{l}</div>
              {loading ? <div className="skeleton" style={{ height:'32px', width:'60%', borderRadius:'6px' }} /> :
                <div style={{ fontSize:'26px', fontWeight:800, color:c as string, fontFamily:"'Space Grotesk', sans-serif" }}>{v}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'advertiser' && (
        <div style={card}>
          {loading ? <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} /> :
          advertiserDeposits.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No advertiser deposits yet</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Date','Advertiser','Amount','Gateway','Status'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advertiserDeposits.map(d=>(
                    <tr key={d.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'9px 10px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(d.created_at).toLocaleString()}</td>
                      <td style={{ padding:'9px 10px', color:'var(--text-secondary)' }}>{d.users?.email||'—'}</td>
                      <td style={{ padding:'9px 10px', color:'#34D399', fontWeight:600 }}>${Number(d.amount_usd).toFixed(2)}</td>
                      <td style={{ padding:'9px 10px', color:'var(--text-muted)' }}>{d.gateway}</td>
                      <td style={{ padding:'9px 10px' }}><span style={{ fontSize:'11px', color:'#34D399', background:'rgba(16,185,129,0.1)', padding:'2px 7px', borderRadius:'4px' }}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'pro' && (
        <div style={card}>
          {loading ? <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} /> :
          proRevenue.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No pro members yet</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['User','Bot','Deposited','Expires','Active'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proRevenue.map(u=>(
                    <tr key={u.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'9px 10px', color:'var(--text-primary)' }}>{u.first_name||'—'}</td>
                      <td style={{ padding:'9px 10px', color:'var(--text-secondary)' }}>{u.bots?.bot_name||'—'}</td>
                      <td style={{ padding:'9px 10px', color:'#34D399', fontWeight:600 }}>${Number(u.pro_deposit_amount||0).toFixed(2)}</td>
                      <td style={{ padding:'9px 10px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{u.pro_expires_at ? new Date(u.pro_expires_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding:'9px 10px' }}>
                        <span style={{ fontSize:'11px', color: u.is_pro_member && u.pro_expires_at && new Date(u.pro_expires_at) > new Date() ? '#34D399' : '#FCA5A5', background: u.is_pro_member && u.pro_expires_at && new Date(u.pro_expires_at) > new Date() ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding:'2px 7px', borderRadius:'4px' }}>
                          {u.is_pro_member && u.pro_expires_at && new Date(u.pro_expires_at) > new Date() ? 'Active' : 'Expired'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
