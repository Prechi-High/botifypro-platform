'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PREBUILT_COMMANDS, COMMAND_CATEGORIES } from '@/lib/prebuiltCommands'
import {
  BookOpen, PenLine, ToggleLeft, ToggleRight, Trash2,
  Plus, AlertCircle, CheckCircle, Loader2, Terminal, ChevronDown
} from 'lucide-react'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export default function CommandsPage() {
  const params = useParams()
  const botId = params.botId as string
  const supabase = createClient()
  const [tab, setTab] = useState<'library'|'custom'>('library')
  const [category, setCategory] = useState('Universal')
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string|null>(null)
  const [newCmd, setNewCmd] = useState('')
  const [newResp, setNewResp] = useState('')
  const [adding, setAdding] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [toast, setToast] = useState<{msg:string,ok:boolean}|null>(null)

  useEffect(() => {
    const c = () => setMobile(window.innerWidth <= 768)
    c(); window.addEventListener('resize', c)
    return () => window.removeEventListener('resize', c)
  }, [])

  function notify(msg: string, ok = true) {
    setToast({msg,ok})
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('bot_commands').select('*').eq('bot_id', botId)
    if (data) setSaved(data)
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  const getSaved = (key: string) => saved.find((c:any) => c.prebuilt_key === key)
  const isOn = (key: string) => { const s = getSaved(key); return !!(s && s.is_active) }

  async function toggle(cmd: typeof PREBUILT_COMMANDS[0]) {
    setSavingKey(cmd.key)
    const ex = getSaved(cmd.key)
    try {
      if (ex) {
        const { error } = await supabase.from('bot_commands').update({ is_active: !ex.is_active }).eq('id', ex.id)
        if (error) throw error
        notify(cmd.command + (ex.is_active ? ' disabled' : ' enabled ✓'))
      } else {
        const { error } = await supabase.from('bot_commands').insert({
          id: crypto.randomUUID(),
          bot_id: botId,
          command: cmd.command,
          response_text: cmd.defaultResponse,
          is_active: true,
          command_category: cmd.category,
          is_prebuilt: true,
          prebuilt_key: cmd.key
        })
        if (error) throw error
        notify(cmd.command + ' enabled ✓')
      }
      await load()
    } catch (e: any) { notify(e.message, false) }
    setSavingKey(null)
  }

  async function saveResp(id: string, text: string) {
    const { error } = await supabase.from('bot_commands').update({ response_text: text }).eq('id', id)
    notify(error ? error.message : 'Saved ✓', !error)
  }

  async function addCustom() {
    if (!newCmd.trim() || !newResp.trim()) { notify('Both fields required', false); return }
    setAdding(true)
    const c = newCmd.trim().startsWith('/') ? newCmd.trim().toLowerCase() : '/'+newCmd.trim().toLowerCase()
    const reserved = ['/start','/help','/balance','/deposit','/withdraw']
    if (reserved.includes(c)) { notify(c+' is reserved', false); setAdding(false); return }
    const { error } = await supabase.from('bot_commands').insert({
      id: crypto.randomUUID(),
      bot_id: botId, command: c, response_text: newResp.trim(),
      is_active: true, command_category: 'custom', is_prebuilt: false, prebuilt_key: null
    })
    if (error) notify(error.code==='23505'?'Already exists':error.message, false)
    else { notify('Added ✓'); setNewCmd(''); setNewResp(''); await load() }
    setAdding(false)
  }

  async function del(id: string, command: string) {
    if (!confirm('Delete '+command+'?')) return
    const { error } = await supabase.from('bot_commands').delete().eq('id', id)
    if (!error) { notify('Deleted ✓'); await load() }
    else notify(error.message, false)
  }

  const catCmds = PREBUILT_COMMANDS.filter(c => c.category === category)
  const customs = saved.filter((c:any) => !c.is_prebuilt)
  const activeCount = saved.filter((c:any) => c.is_active).length

  return (
    <div style={{maxWidth:'960px',margin:'0 auto',background:'var(--bg-base)',minHeight:'100vh',color:'var(--text-primary)'}}>
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

      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:'600',color:'#1e293b',margin:'0 0 4px',display:'flex',alignItems:'center',gap:'8px'}}>
          <Terminal size={22} color='#3b82f6'/>Bot Commands
        </h1>
        <p style={{color:'#64748b',fontSize:'13px',margin:0}}>
          {activeCount} active command{activeCount!==1?'s':''} — enable from library or create your own
        </p>
      </div>

      <div style={{display:'flex',gap:'4px',background:'#f1f5f9',borderRadius:'10px',padding:'4px',marginBottom:'20px',width:'fit-content'}}>
        {(['library','custom'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'7px 16px',borderRadius:'8px',border:'none',cursor:'pointer',
            fontSize:'13px',fontWeight:tab===t?'500':'400',
            background:tab===t?'white':'transparent',
            color:tab===t?'#1e293b':'#64748b',
            boxShadow:tab===t?'0 1px 3px rgba(0,0,0,0.1)':'none',
            display:'flex',alignItems:'center',gap:'6px',transition:'all 0.15s'
          }}>
            {t==='library'?<><BookOpen size={14}/>Library</>:<><PenLine size={14}/>Custom</>}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{display:'flex',alignItems:'center',gap:'8px',color:'#94a3b8',padding:'20px'}}>
          <Loader2 size={18} style={{animation:'spin 1s linear infinite'}}/>Loading...
        </div>
      )}

      {!loading && tab==='library' && (
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'190px 1fr',gap:'12px'}}>

          {mobile && (
            <div style={{position:'relative'}}>
              <button onClick={()=>setCatOpen(!catOpen)} style={{
                width:'100%',padding:'10px 14px',background:'white',
                border:'1px solid #e2e8f0',borderRadius:'10px',cursor:'pointer',
                display:'flex',justifyContent:'space-between',alignItems:'center',
                fontSize:'13px',fontWeight:'500',color:'#1e293b'
              }}>
                {category}
                <ChevronDown size={16} style={{transform:catOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
              </button>
              {catOpen && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:50,background:'white',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden',marginTop:'4px'}}>
                  {COMMAND_CATEGORIES.map(cat => {
                    const n = PREBUILT_COMMANDS.filter(c=>c.category===cat&&isOn(c.key)).length
                    return (
                      <button key={cat} onClick={()=>{setCategory(cat);setCatOpen(false)}} style={{
                        width:'100%',padding:'10px 14px',border:'none',cursor:'pointer',
                        textAlign:'left',background:category===cat?'#eff6ff':'white',
                        color:category===cat?'#1d4ed8':'#475569',fontSize:'13px',
                        display:'flex',justifyContent:'space-between',alignItems:'center',
                        borderBottom:'1px solid #f1f5f9'
                      }}>
                        {cat}
                        {n>0&&<span style={{background:'#2563eb',color:'white',borderRadius:'10px',padding:'1px 6px',fontSize:'10px',fontWeight:'600'}}>{n}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!mobile && (
            <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
              {COMMAND_CATEGORIES.map(cat => {
                const n = PREBUILT_COMMANDS.filter(c=>c.category===cat&&isOn(c.key)).length
                return (
                  <button key={cat} onClick={()=>setCategory(cat)} style={{
                    padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',
                    textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',
                    border:category===cat?'1px solid #bfdbfe':'1px solid transparent',
                    background:category===cat?'#eff6ff':'transparent',
                    color:category===cat?'#1d4ed8':'#475569',
                    fontWeight:category===cat?'500':'400'
                  }}>
                    {cat}
                    {n>0&&<span style={{background:'#2563eb',color:'white',borderRadius:'10px',padding:'1px 6px',fontSize:'10px',fontWeight:'600'}}>{n}</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {catCmds.map(cmd => {
              const on = isOn(cmd.key)
              const ex = getSaved(cmd.key)
              const busy = savingKey===cmd.key
              return (
                <div key={cmd.key} style={{
                  background:'rgba(255,255,255,0.03)',
                  border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'12px',padding:'12px 14px',transition:'all 0.2s'
                }}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexWrap:'wrap'}}>
                        <code style={{
                          background:on?'#dcfce7':'#f1f5f9',
                          color:on?'#166534':'#475569',
                          padding:'2px 8px',borderRadius:'6px',
                          fontSize:'12px',fontWeight:'600',fontFamily:'monospace'
                        }}>{cmd.command}</code>
                        {on&&<span style={{background:'#dcfce7',color:'#166534',padding:'1px 7px',borderRadius:'20px',fontSize:'10px',fontWeight:'600'}}>Active</span>}
                        {cmd.needsSetup&&<span style={{background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:'20px',fontSize:'10px',fontWeight:'500'}}>Setup required</span>}
                      </div>
                      <p style={{color:'#64748b',fontSize:'12px',margin:'0 0 2px'}}>{cmd.description}</p>
                      {cmd.needsSetup&&cmd.setupInstructions&&(
                        <p style={{color:'#d97706',fontSize:'11px',margin:'3px 0 0',fontStyle:'italic',display:'flex',alignItems:'center',gap:'4px'}}>
                          <AlertCircle size={11}/>{cmd.setupInstructions}
                        </p>
                      )}
                    </div>
                    <button onClick={()=>!busy&&toggle(cmd)} disabled={busy} style={{background:'none',border:'none',cursor:busy?'wait':'pointer',flexShrink:0,marginTop:'2px',opacity:busy?0.6:1,display:'flex',alignItems:'center'}}>
                      {busy
                        ? <Loader2 size={24} color='#94a3b8' style={{animation:'spin 1s linear infinite'}}/>
                        : on
                          ? <ToggleRight size={30} color='#16a34a'/>
                          : <ToggleLeft size={30} color='#cbd5e1'/>
                      }
                    </button>
                  </div>
                  {on&&ex&&(
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #dcfce7'}}>
                      <label style={{fontSize:'11px',fontWeight:'500',color:'#166534',display:'block',marginBottom:'4px'}}>
                        Customise response (click outside to save):
                      </label>
                      <textarea
                        key={ex.id}
                        defaultValue={stripHtml(ex.response_text || '')}
                        onBlur={e=>saveResp(ex.id, e.target.value)}
                        rows={3}
                        style={{width:'100%',padding:'8px',border:'1px solid #bbf7d0',borderRadius:'6px',fontSize:'12px',fontFamily:'monospace',background:'white',resize:'vertical',boxSizing:'border-box'}}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && tab==='custom' && (
        <div>
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px',display:'flex',alignItems:'center',gap:'6px'}}>
              <Plus size={15} color='#3b82f6'/>Add Custom Command
            </h3>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 2fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={{fontSize:'12px',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>Command</label>
                <input value={newCmd} onChange={e=>setNewCmd(e.target.value)} placeholder="/mycommand"
                  style={{width:'100%',padding:'9px 10px',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'13px',fontFamily:'monospace',boxSizing:'border-box'}}
                />
              </div>
              <div>
                <label style={{fontSize:'12px',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>Response</label>
                <input value={newResp} onChange={e=>setNewResp(e.target.value)}
                  placeholder="What bot replies when users type this command"
                  onKeyDown={e=>e.key==='Enter'&&addCustom()}
                  style={{width:'100%',padding:'9px 10px',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}}
                />
              </div>
            </div>
            <button onClick={addCustom} disabled={adding||!newCmd.trim()||!newResp.trim()}
              style={{padding:'8px 16px',background:adding?'#93c5fd':'#2563eb',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:adding?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'6px'}}
            >
              {adding?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>Adding...</>:<><Plus size={14}/>Add Command</>}
            </button>
            <div style={{marginTop:'10px',padding:'8px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'6px',fontSize:'12px',color:'#92400e',display:'flex',gap:'6px',alignItems:'center'}}>
              <AlertCircle size={13}/>
              Reserved: /start · /help · /balance · /deposit · /withdraw
            </div>
          </div>

          {customs.length===0?(
            <div style={{textAlign:'center',padding:'40px',background:'white',borderRadius:'12px',border:'1px dashed #e2e8f0'}}>
              <PenLine size={30} color='#cbd5e1' style={{marginBottom:'10px'}}/>
              <p style={{color:'#94a3b8',fontSize:'13px',margin:0}}>No custom commands yet. Add your first one above.</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {customs.map((cmd:any)=>(
                <div key={cmd.id} style={{
                  background:'rgba(255,255,255,0.03)',
                  border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'12px',padding:'12px 14px',opacity:cmd.is_active?1:0.7,
                  display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',
                  flexWrap:mobile?'wrap':'nowrap'
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',flex:1,minWidth:0}}>
                    <code style={{background:'#f1f5f9',padding:'2px 8px',borderRadius:'6px',fontSize:'12px',fontWeight:'600',fontFamily:'monospace',color:'#1e293b',flexShrink:0}}>{cmd.command}</code>
                    <span style={{color:'#64748b',fontSize:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {cmd.response_text.substring(0,70)}{cmd.response_text.length>70?'...':''}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    <button onClick={async()=>{await supabase.from('bot_commands').update({is_active:!cmd.is_active}).eq('id',cmd.id);await load()}}
                      style={{padding:'5px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',background:'white',color:'#64748b',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                      {cmd.is_active?<><ToggleRight size={13} color='#16a34a'/>Disable</>:<><ToggleLeft size={13}/>Enable</>}
                    </button>
                    <button onClick={()=>del(cmd.id,cmd.command)}
                      style={{padding:'5px 10px',border:'1px solid #fecaca',borderRadius:'6px',background:'#fef2f2',color:'#dc2626',fontSize:'12px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
                      <Trash2 size={13}/>Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

