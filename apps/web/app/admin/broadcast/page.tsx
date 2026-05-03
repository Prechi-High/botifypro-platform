'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Radio, Send } from 'lucide-react'

export default function AdminBroadcastPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [bots, setBots] = useState<any[]>([])
  const [selectedBot, setSelectedBot] = useState<string>('all')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)
  const [history, setHistory] = useState<any[]>([])

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),4000) }

  useEffect(() => {
    supabase.from('bots').select('id, bot_name, bot_username').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setBots(data || []))
  }, [])

  async function send() {
    if (!message.trim()) { notify('Enter a message first', false); return }
    if (!confirm(`Send this message to ${selectedBot === 'all' ? 'ALL bot users' : 'selected bot users'}?`)) return
    setSending(true)
    try {
      const body: any = { message }
      if (selectedBot !== 'all') body.botId = selectedBot

      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success || data.sent !== undefined) {
        notify(`Broadcast sent to ${data.sent || 0} users`)
        setHistory(prev => [{ message, target: selectedBot === 'all' ? 'All bots' : bots.find(b=>b.id===selectedBot)?.bot_name||'Bot', sent: data.sent||0, date: new Date().toISOString() }, ...prev.slice(0,9)])
        setMessage('')
      } else {
        notify(data.error || 'Broadcast failed', false)
      }
    } catch (e: any) {
      notify(e.message || 'Failed to send broadcast', false)
    }
    setSending(false)
  }

  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>{toast.msg}</div>}

      <div>
        <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
          <Radio size={20} /> Broadcast
        </h1>
        <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>Send a message to all or specific bot users</p>
      </div>

      <div style={card}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'6px' }}>Target</label>
            <select value={selectedBot} onChange={e=>setSelectedBot(e.target.value)} className="input-field" style={{ cursor:'pointer' }}>
              <option value="all">All bot users (across all bots)</option>
              {bots.map(b=>(
                <option key={b.id} value={b.id}>{b.bot_name || b.bot_username || b.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'6px' }}>
              Message <span style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:400 }}>(HTML supported: &lt;b&gt;, &lt;i&gt;, &lt;a href=""&gt;)</span>
            </label>
            <textarea
              value={message}
              onChange={e=>setMessage(e.target.value)}
              className="input-field"
              style={{ minHeight:'120px', resize:'vertical', fontFamily:'monospace', fontSize:'13px' }}
              placeholder="Type your broadcast message here..."
            />
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{message.length} characters</div>
          </div>

          {message && (
            <div>
              <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:'6px', fontWeight:500 }}>Preview:</div>
              <div style={{ padding:'12px 14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', fontSize:'13px', color:'var(--text-primary)', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: message.replace(/\n/g,'<br/>') }} />
            </div>
          )}

          <button onClick={send} disabled={sending || !message.trim()} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'center', padding:'12px' }}>
            <Send size={15} />
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontSize:'14px', fontWeight:600, color:'var(--text-primary)' }}>Recent Broadcasts</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {history.map((h,i)=>(
              <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>→ {h.target}</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{new Date(h.date).toLocaleString()} · {h.sent} sent</span>
                </div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
