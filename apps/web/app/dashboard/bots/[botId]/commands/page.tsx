'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  PenLine, ToggleLeft, ToggleRight, Trash2,
  Plus, AlertCircle, CheckCircle, Loader2, MessageSquareReply
} from 'lucide-react'

export default function CommandsPage() {
  const params = useParams()
  const botId = params.botId as string
  const supabase = createClient()
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newCmd, setNewCmd] = useState('')
  const [newResp, setNewResp] = useState('')
  const [adding, setAdding] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null)

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function notify(msg: string, ok = true) {
    setToast({msg, ok})
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('bot_commands').select('*').eq('bot_id', botId).eq('is_prebuilt', false)
    if (data) setSaved(data)
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  async function addReply() {
    if (!newCmd.trim() || !newResp.trim()) { notify('Both fields required', false); return }
    setAdding(true)
    const trigger = newCmd.trim()
    const { error } = await supabase.from('bot_commands').insert({
      id: crypto.randomUUID(),
      bot_id: botId,
      command: trigger,
      response_text: newResp.trim(),
      is_active: true,
      command_category: 'custom',
      is_prebuilt: false,
      prebuilt_key: null
    })
    if (error) notify(error.code === '23505' ? 'That trigger already exists' : error.message, false)
    else { notify('Auto reply added ✓'); setNewCmd(''); setNewResp(''); await load() }
    setAdding(false)
  }

  async function del(id: string, command: string) {
    if (!confirm('Delete auto reply for "' + command + '"?')) return
    const { error } = await supabase.from('bot_commands').delete().eq('id', id)
    if (!error) { notify('Deleted ✓'); await load() }
    else notify(error.message, false)
  }

  const activeCount = saved.filter((c:any) => c.is_active).length

  return (
    <div style={{maxWidth:'860px',margin:'0 auto',background:'var(--bg-base)',minHeight:'100vh',color:'var(--text-primary)'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {toast && (
        <div style={{
          position:'fixed',top:'20px',right:'20px',zIndex:9999,
          padding:'11px 16px',borderRadius:'10px',fontSize:'13px',fontWeight:'500',
          display:'flex',alignItems:'center',gap:'8px',
          background:toast.ok?'#f0fdf4':'#fef2f2',
          border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`,
          color:toast.ok?'#166534':'#dc2626',
          boxShadow:'0 4px 16px rgba(0,0,0,0.12)'
        }}>
          {toast.ok ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
          {toast.msg}
        </div>
      )}

      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'20px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 4px',display:'flex',alignItems:'center',gap:'8px'}}>
          <MessageSquareReply size={22} color='#3b82f6'/>Auto Replies
        </h1>
        <p style={{color:'var(--text-muted)',fontSize:'13px',margin:0}}>
          When a user sends an exact message, the bot replies automatically.
          {activeCount > 0 && <> · <strong style={{color:'var(--text-secondary)'}}>{activeCount} active</strong></>}
        </p>
      </div>

      <div style={{background:'var(--bg-card, white)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
        <h3 style={{fontSize:'14px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 12px',display:'flex',alignItems:'center',gap:'6px'}}>
          <Plus size={15} color='#3b82f6'/>New Auto Reply
        </h3>
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 2fr',gap:'10px',marginBottom:'10px'}}>
          <div>
            <label style={{fontSize:'12px',fontWeight:'500',color:'var(--text-secondary)',display:'block',marginBottom:'4px'}}>Trigger text</label>
            <input
              value={newCmd}
              onChange={e => setNewCmd(e.target.value)}
              placeholder="e.g. hello or /mycommand"
              style={{width:'100%',padding:'9px 10px',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',fontFamily:'monospace',boxSizing:'border-box',background:'var(--bg-input,white)',color:'var(--text-primary)'}}
            />
          </div>
          <div>
            <label style={{fontSize:'12px',fontWeight:'500',color:'var(--text-secondary)',display:'block',marginBottom:'4px'}}>Bot reply</label>
            <input
              value={newResp}
              onChange={e => setNewResp(e.target.value)}
              placeholder="What the bot sends when this text is received"
              onKeyDown={e => e.key === 'Enter' && addReply()}
              style={{width:'100%',padding:'9px 10px',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box',background:'var(--bg-input,white)',color:'var(--text-primary)'}}
            />
          </div>
        </div>
        <button
          onClick={addReply}
          disabled={adding || !newCmd.trim() || !newResp.trim()}
          style={{padding:'8px 16px',background:adding?'#93c5fd':'#2563eb',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:adding?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px'}}
        >
          {adding ? <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>Adding...</> : <><Plus size={14}/>Add Auto Reply</>}
        </button>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'8px',color:'var(--text-muted)',padding:'20px'}}>
          <Loader2 size={18} style={{animation:'spin 1s linear infinite'}}/>Loading...
        </div>
      ) : saved.length === 0 ? (
        <div style={{textAlign:'center',padding:'48px',background:'var(--bg-card,white)',borderRadius:'12px',border:'1px dashed var(--border)'}}>
          <MessageSquareReply size={32} color='#cbd5e1' style={{marginBottom:'12px'}}/>
          <p style={{color:'var(--text-muted)',fontSize:'13px',margin:0}}>No auto replies yet. Add your first one above.</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          {saved.map((cmd:any) => (
            <div key={cmd.id} style={{
              background:'rgba(255,255,255,0.03)',
              border:'1px solid var(--border)',
              borderRadius:'12px',padding:'12px 14px',
              opacity:cmd.is_active ? 1 : 0.6,
              display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',
              flexWrap:mobile ? 'wrap' : 'nowrap'
            }}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',flex:1,minWidth:0}}>
                <code style={{background:'var(--bg-muted,#f1f5f9)',padding:'2px 8px',borderRadius:'6px',fontSize:'12px',fontWeight:'600',fontFamily:'monospace',color:'var(--text-primary)',flexShrink:0}}>
                  {cmd.command}
                </code>
                <span style={{color:'var(--text-muted)',fontSize:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {cmd.response_text.substring(0, 80)}{cmd.response_text.length > 80 ? '…' : ''}
                </span>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                <button
                  onClick={async () => { await supabase.from('bot_commands').update({is_active:!cmd.is_active}).eq('id',cmd.id); await load() }}
                  style={{padding:'5px 10px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg-card,white)',color:'var(--text-secondary)',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}
                >
                  {cmd.is_active ? <><ToggleRight size={13} color='#16a34a'/>Disable</> : <><ToggleLeft size={13}/>Enable</>}
                </button>
                <button
                  onClick={() => del(cmd.id, cmd.command)}
                  style={{padding:'5px 10px',border:'1px solid #fecaca',borderRadius:'6px',background:'#fef2f2',color:'#dc2626',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}
                >
                  <Trash2 size={13}/>Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
