'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowUpDown, Search, RefreshCw } from 'lucide-react'

type Tab = 'all' | 'pending' | 'deposits'

export default function AdminTransactionsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('all')
  const [txns, setTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  async function load() {
    setLoading(true)
    try {
      let query = supabase.from('transactions')
        .select('id, type, amount_currency, amount_usd, status, gateway, gateway_tx_id, withdraw_address, platform_fee_amount, created_at, bot_users(first_name, telegram_username), bots(bot_name, bot_username)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (tab === 'pending') query = query.eq('status', 'pending')
      else if (tab === 'deposits') query = query.eq('type', 'deposit')

      const { data } = await query
      setTxns(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const filtered = txns.filter(t => {
    if (!search) return true
    const s = search.toLowerCase()
    return (t.bot_users?.first_name||'').toLowerCase().includes(s) ||
      (t.bots?.bot_name||'').toLowerCase().includes(s) ||
      (t.gateway_tx_id||'').toLowerCase().includes(s) ||
      (t.withdraw_address||'').toLowerCase().includes(s)
  })

  const statusColor: Record<string,string> = { completed:'#34D399', pending:'#FBBF24', failed:'#FCA5A5', processing:'#60A5FA' }
  const typeColor: Record<string,string> = { deposit:'#34D399', withdrawal:'#FBBF24', bonus:'#818CF8', referral:'#60A5FA' }
  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>{toast.msg}</div>}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
            <ArrowUpDown size={20} /> Transactions
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>{filtered.length} shown</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {([['all','All'],['pending','Pending Withdrawals'],['deposits','Deposits']] as [Tab,string][]).map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${tab===k?'rgba(57,255,20,0.4)':'rgba(255,255,255,0.08)'}`, background:tab===k?'rgba(57,255,20,0.1)':'transparent', color:tab===k?'var(--accent)':'var(--text-secondary)', fontSize:'13px', fontWeight:tab===k?600:400, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={{ position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by user, bot, tx ID or address..." className="input-field" style={{ paddingLeft:'36px' }} />
      </div>

      <div style={card}>
        {loading ? <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} /> :
        filtered.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No transactions found</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Date/Time','Type','User','Bot','Amount USD','Status','Gateway','Fee'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t=>(
                  <tr key={t.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'9px 10px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(t.created_at).toLocaleString()}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 7px', borderRadius:'4px', background:`${typeColor[t.type]||'#94a3b8'}22`, color:typeColor[t.type]||'#94a3b8' }}>{t.type}</span>
                    </td>
                    <td style={{ padding:'9px 10px', color:'var(--text-secondary)' }}>{t.bot_users?.first_name||'—'}</td>
                    <td style={{ padding:'9px 10px', color:'var(--text-secondary)' }}>{t.bots?.bot_name||'—'}</td>
                    <td style={{ padding:'9px 10px', color:'var(--text-primary)', fontWeight:600 }}>${Number(t.amount_usd||0).toFixed(4)}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 7px', borderRadius:'4px', background:`${statusColor[t.status]||'#94a3b8'}22`, color:statusColor[t.status]||'#94a3b8' }}>{t.status}</span>
                    </td>
                    <td style={{ padding:'9px 10px', color:'var(--text-muted)' }}>{t.gateway||'—'}</td>
                    <td style={{ padding:'9px 10px', color:'var(--text-muted)' }}>${Number(t.platform_fee_amount||0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
