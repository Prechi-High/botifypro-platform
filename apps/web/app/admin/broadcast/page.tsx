'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Radio, Send, Image, Link, X } from 'lucide-react'

export default function AdminBroadcastPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bots, setBots] = useState<any[]>([])
  const [selectedBot, setSelectedBot] = useState<string>('all')
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)
  const [history, setHistory] = useState<any[]>([])

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),4000) }

  useEffect(() => {
    supabase.from('bots').select('id, bot_name, bot_username').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setBots(data || []))
  }, [])

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageUrl(result)
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageUrl('')
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function send() {
    if (!text.trim()) { notify('Enter a message first', false); return }
    const target = selectedBot === 'all' ? 'ALL bot users across all bots' : `users of ${bots.find(b=>b.id===selectedBot)?.bot_name || 'selected bot'}`
    if (!confirm(`Send this broadcast to ${target}?`)) return

    setSending(true)
    try {
      const body: any = { text }
      if (selectedBot !== 'all') body.botId = selectedBot
      if (imageUrl) body.imageUrl = imageUrl
      if (buttonText && buttonUrl) { body.buttonText = buttonText; body.buttonUrl = buttonUrl }

      const res = await fetch(`${BOT_ENGINE_URL}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success || data.sent !== undefined) {
        notify(`✓ Broadcast sent to ${data.sent || 0} users${data.failed ? ` (${data.failed} failed)` : ''}`)
        setHistory(prev => [{
          text, imageUrl: imagePreview, buttonText, buttonUrl,
          target: selectedBot === 'all' ? 'All bots' : bots.find(b=>b.id===selectedBot)?.bot_name||'Bot',
          sent: data.sent||0, failed: data.failed||0, date: new Date().toISOString()
        }, ...prev.slice(0,9)])
        setText('')
        clearImage()
        setButtonText('')
        setButtonUrl('')
      } else {
        notify(data.error || 'Broadcast failed', false)
      }
    } catch (e: any) {
      notify(e.message || 'Failed to send broadcast', false)
    }
    setSending(false)
  }

  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }
  const label: React.CSSProperties = { display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'6px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', pointerEvents:'none' }}>{toast.msg}</div>}

      <div>
        <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
          <Radio size={20} /> Broadcast
        </h1>
        <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>Send a message to all or specific bot users</p>
      </div>

      <div style={card}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Target */}
          <div>
            <label style={label}>Target</label>
            <select value={selectedBot} onChange={e=>setSelectedBot(e.target.value)} className="input-field" style={{ cursor:'pointer' }}>
              <option value="all">All bot users (across all active bots)</option>
              {bots.map(b=>(
                <option key={b.id} value={b.id}>{b.bot_name || b.bot_username || b.id}</option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label style={label}>
              Message <span style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:400 }}>(HTML: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;a href=""&gt;link&lt;/a&gt;)</span>
            </label>
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              className="input-field"
              style={{ minHeight:'120px', resize:'vertical', fontFamily:'monospace', fontSize:'13px' }}
              placeholder="Type your broadcast message here..."
            />
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{text.length} characters</div>
          </div>

          {/* Image */}
          <div>
            <label style={{ ...label, display:'flex', alignItems:'center', gap:'6px' }}>
              <Image size={13} /> Image (optional)
            </label>
            {imagePreview ? (
              <div style={{ position:'relative', display:'inline-block' }}>
                <img src={imagePreview} alt="preview" style={{ maxWidth:'200px', maxHeight:'150px', borderRadius:'8px', border:'1px solid var(--border)' }} />
                <button onClick={clearImage} style={{ position:'absolute', top:'-8px', right:'-8px', width:'22px', height:'22px', borderRadius:'50%', background:'#ef4444', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input
                  value={imageUrl}
                  onChange={e=>{ setImageUrl(e.target.value); setImagePreview(e.target.value) }}
                  className="input-field"
                  placeholder="Paste image URL..."
                  style={{ flex:1 }}
                />
                <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>or</span>
                <button type="button" onClick={()=>fileInputRef.current?.click()} className="btn-ghost" style={{ whiteSpace:'nowrap', fontSize:'12px' }}>
                  Upload file
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display:'none' }} />
              </div>
            )}
          </div>

          {/* Button */}
          <div>
            <label style={{ ...label, display:'flex', alignItems:'center', gap:'6px' }}>
              <Link size={13} /> Inline Button (optional)
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <input value={buttonText} onChange={e=>setButtonText(e.target.value)} className="input-field" placeholder="Button text" />
              <input value={buttonUrl} onChange={e=>setButtonUrl(e.target.value)} className="input-field" placeholder="https://..." />
            </div>
          </div>

          {/* Preview */}
          {text && (
            <div>
              <label style={label}>Preview</label>
              <div style={{ padding:'14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px' }}>
                {imagePreview && <img src={imagePreview} alt="" style={{ maxWidth:'100%', maxHeight:'200px', borderRadius:'6px', marginBottom:'8px', display:'block' }} />}
                <div style={{ fontSize:'13px', color:'var(--text-primary)', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: text.replace(/\n/g,'<br/>') }} />
                {buttonText && buttonUrl && (
                  <div style={{ marginTop:'10px' }}>
                    <a href={buttonUrl} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', padding:'8px 16px', background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.3)', borderRadius:'8px', color:'var(--accent)', textDecoration:'none', fontSize:'13px', fontWeight:500 }}>
                      {buttonText}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <button onClick={send} disabled={sending || !text.trim()} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'center', padding:'12px', borderRadius:'10px', fontSize:'14px' }}>
            <Send size={15} />
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ margin:'0 0 14px', fontSize:'14px', fontWeight:600, color:'var(--text-primary)' }}>Recent Broadcasts</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {history.map((h,i)=>(
              <div key={i} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px', flexWrap:'wrap', gap:'6px' }}>
                  <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>→ {h.target}</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{new Date(h.date).toLocaleString()} · {h.sent} sent{h.failed ? `, ${h.failed} failed` : ''}</span>
                </div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
