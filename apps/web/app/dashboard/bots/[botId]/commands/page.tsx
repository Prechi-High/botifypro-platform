'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PREBUILT_COMMANDS, COMMAND_CATEGORIES } from '@/lib/prebuiltCommands'

export default function CommandsPage({ params }: { params: { botId: string } }) {
  const botId = params.botId
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'library' | 'custom'>('library')
  const [selectedCategory, setSelectedCategory] = useState('Universal')
  const [savedCommands, setSavedCommands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newCommand, setNewCommand] = useState('')
  const [newResponse, setNewResponse] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [toast, setToast] = useState<{msg:string,type:'success'|'error'}|null>(null)

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({msg, type})
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { loadCommands() }, [botId])

  async function loadCommands() {
    setLoading(true)
    const { data, error } = await supabase
      .from('bot_commands')
      .select('*')
      .eq('bot_id', botId)
    if (error) console.error('Load error:', error)
    if (data) setSavedCommands(data)
    setLoading(false)
  }

  function getSaved(prebuiltKey: string) {
    return savedCommands.find((c: any) => c.prebuilt_key === prebuiltKey)
  }

  function isEnabled(prebuiltKey: string) {
    const s = getSaved(prebuiltKey)
    return !!(s && s.is_active)
  }

  async function toggleCommand(cmd: typeof PREBUILT_COMMANDS[0]) {
    setSaving(cmd.key)
    const existing = getSaved(cmd.key)
    try {
      if (existing) {
        const { error } = await supabase
          .from('bot_commands')
          .update({ is_active: !existing.is_active })
          .eq('id', existing.id)
        if (error) throw error
        showToast(existing.is_active ? cmd.command + ' disabled' : cmd.command + ' enabled ✓')
      } else {
        const { error } = await supabase
          .from('bot_commands')
          .insert({
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
        showToast(cmd.command + ' enabled ✓')
      }
      await loadCommands()
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error')
    }
    setSaving(null)
  }

  async function saveResponse(id: string, text: string) {
    const { error } = await supabase
      .from('bot_commands')
      .update({ response_text: text })
      .eq('id', id)
    if (!error) showToast('Response saved ✓')
    else showToast('Save failed', 'error')
  }

  async function addCustom() {
    if (!newCommand.trim() || !newResponse.trim()) {
      showToast('Command and response are required', 'error')
      return
    }
    setAddingCustom(true)
    const cmd = newCommand.trim().toLowerCase().startsWith('/')
      ? newCommand.trim().toLowerCase()
      : '/' + newCommand.trim().toLowerCase()

    const reserved = ['/start','/help','/balance','/deposit','/withdraw']
    if (reserved.includes(cmd)) {
      showToast(cmd + ' is a reserved command', 'error')
      setAddingCustom(false)
      return
    }

    const { error } = await supabase
      .from('bot_commands')
      .insert({
        id: crypto.randomUUID(),
        bot_id: botId,
        command: cmd,
        response_text: newResponse.trim(),
        is_active: true,
        command_category: 'custom',
        is_prebuilt: false,
        prebuilt_key: null
      })

    if (error) {
      if (error.message.includes('unique') || error.code === '23505') {
        showToast('This command already exists', 'error')
      } else {
        showToast('Error: ' + error.message, 'error')
      }
    } else {
      showToast('Custom command added ✓')
      setNewCommand('')
      setNewResponse('')
      await loadCommands()
    }
    setAddingCustom(false)
  }

  async function deleteCommand(id: string, command: string) {
    if (!confirm('Delete ' + command + '?')) return
    const { error } = await supabase.from('bot_commands').delete().eq('id', id)
    if (!error) { showToast('Deleted ✓'); await loadCommands() }
    else showToast('Delete failed', 'error')
  }

  const prebuiltInCategory = PREBUILT_COMMANDS.filter(c => c.category === selectedCategory)
  const customCommands = savedCommands.filter((c: any) => !c.is_prebuilt)

  return (
    <div style={{padding:'20px',maxWidth:'960px',position:'relative'}}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',top:'20px',right:'20px',zIndex:9999,
          padding:'10px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:'500',
          background: toast.type==='success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.type==='success' ? '#bbf7d0' : '#fecaca'}`,
          color: toast.type==='success' ? '#166534' : '#dc2626',
          boxShadow:'0 4px 12px rgba(0,0,0,0.1)'
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:'600',color:'#1e293b',margin:'0 0 4px'}}>Bot Commands</h1>
        <p style={{color:'#64748b',fontSize:'13px',margin:0}}>
          Enable pre-built commands from the library or create your own custom commands.
          {' '}<strong style={{color:'#2563eb'}}>{savedCommands.filter((c:any)=>c.is_active).length} active commands</strong>
        </p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',background:'#f1f5f9',borderRadius:'10px',padding:'4px',marginBottom:'20px',width:'fit-content'}}>
        {(['library','custom'] as const).map(t => (
          <button key={t} onClick={()=>setActiveTab(t)} style={{
            padding:'7px 18px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'13px',
            fontWeight: activeTab===t ? '500' : '400',
            background: activeTab===t ? 'white' : 'transparent',
            color: activeTab===t ? '#1e293b' : '#64748b',
            boxShadow: activeTab===t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition:'all 0.15s'
          }}>
            {t==='library' ? '📚 Command Library' : '✏️ Custom Commands'}
          </button>
        ))}
      </div>

      {loading && <div style={{color:'#94a3b8',padding:'20px'}}>Loading commands...</div>}

      {!loading && activeTab === 'library' && (
        <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:'12px'}}>

          {/* Category sidebar */}
          <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
            {COMMAND_CATEGORIES.map(cat => {
              const catCmds = PREBUILT_COMMANDS.filter(c=>c.category===cat)
              const enabledCount = catCmds.filter(c=>isEnabled(c.key)).length
              return (
                <button key={cat} onClick={()=>setSelectedCategory(cat)} style={{
                  padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',
                  textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',
                  border: selectedCategory===cat ? '1px solid #bfdbfe' : '1px solid transparent',
                  background: selectedCategory===cat ? '#eff6ff' : 'transparent',
                  color: selectedCategory===cat ? '#1d4ed8' : '#475569',
                  fontWeight: selectedCategory===cat ? '500' : '400'
                }}>
                  <span>{cat}</span>
                  {enabledCount > 0 && (
                    <span style={{background:'#2563eb',color:'white',borderRadius:'10px',padding:'1px 6px',fontSize:'10px',fontWeight:'600'}}>
                      {enabledCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Commands list */}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {prebuiltInCategory.map(cmd => {
              const enabled = isEnabled(cmd.key)
              const existing = getSaved(cmd.key)
              const isSaving = saving === cmd.key

              return (
                <div key={cmd.key} style={{
                  background: enabled ? '#f0fdf4' : 'white',
                  border: `1px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius:'10px',padding:'12px 14px',transition:'all 0.2s'
                }}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexWrap:'wrap'}}>
                        <code style={{
                          background: enabled ? '#dcfce7' : '#f1f5f9',
                          color: enabled ? '#166534' : '#475569',
                          padding:'2px 8px',borderRadius:'6px',
                          fontSize:'12px',fontWeight:'600',fontFamily:'monospace'
                        }}>{cmd.command}</code>
                        {cmd.needsSetup && (
                          <span style={{background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:'20px',fontSize:'10px',fontWeight:'500'}}>
                            Requires setup
                          </span>
                        )}
                        {enabled && (
                          <span style={{background:'#dcfce7',color:'#166534',padding:'1px 7px',borderRadius:'20px',fontSize:'10px',fontWeight:'500'}}>
                            Active
                          </span>
                        )}
                      </div>
                      <p style={{color:'#64748b',fontSize:'12px',margin:'0 0 2px'}}>{cmd.description}</p>
                      {cmd.needsSetup && cmd.setupInstructions && (
                        <p style={{color:'#d97706',fontSize:'11px',margin:'3px 0 0',fontStyle:'italic'}}>
                          ⚠️ {cmd.setupInstructions}
                        </p>
                      )}
                    </div>

                    {/* Toggle switch */}
                    <div
                      onClick={() => !isSaving && toggleCommand(cmd)}
                      style={{
                        width:'40px',height:'22px',borderRadius:'11px',flexShrink:0,marginTop:'2px',
                        background: enabled ? '#16a34a' : '#cbd5e1',
                        position:'relative',cursor: isSaving ? 'wait' : 'pointer',
                        transition:'background 0.2s',opacity: isSaving ? 0.6 : 1
                      }}
                    >
                      <div style={{
                        position:'absolute',top:'3px',
                        left: enabled ? '21px' : '3px',
                        width:'16px',height:'16px',borderRadius:'50%',
                        background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        transition:'left 0.2s'
                      }}/>
                    </div>
                  </div>

                  {/* Editable response shown when enabled */}
                  {enabled && existing && (
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #dcfce7'}}>
                      <label style={{fontSize:'11px',fontWeight:'500',color:'#166534',display:'block',marginBottom:'4px'}}>
                        Customise bot response (click outside to save):
                      </label>
                      <textarea
                        key={existing.id}
                        defaultValue={existing.response_text}
                        onBlur={e => saveResponse(existing.id, e.target.value)}
                        rows={3}
                        style={{
                          width:'100%',padding:'8px',border:'1px solid #bbf7d0',borderRadius:'6px',
                          fontSize:'12px',fontFamily:'monospace',background:'white',
                          resize:'vertical',boxSizing:'border-box'
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && activeTab === 'custom' && (
        <div>
          {/* Add custom command */}
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Add Custom Command</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={{fontSize:'12px',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>Command</label>
                <input
                  value={newCommand}
                  onChange={e=>setNewCommand(e.target.value)}
                  placeholder="/mycommand"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'13px',fontFamily:'monospace',boxSizing:'border-box'}}
                />
              </div>
              <div>
                <label style={{fontSize:'12px',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>Response</label>
                <input
                  value={newResponse}
                  onChange={e=>setNewResponse(e.target.value)}
                  placeholder="What the bot says when users send this command"
                  onKeyDown={e=>{ if(e.key==='Enter') addCustom() }}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box'}}
                />
              </div>
            </div>
            <button
              onClick={addCustom}
              disabled={addingCustom || !newCommand.trim() || !newResponse.trim()}
              style={{
                padding:'8px 16px',background: addingCustom ? '#93c5fd' : '#2563eb',color:'white',
                border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',
                cursor: addingCustom ? 'not-allowed' : 'pointer'
              }}
            >
              {addingCustom ? 'Adding...' : 'Add Command'}
            </button>
            <div style={{marginTop:'10px',padding:'8px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'6px',fontSize:'12px',color:'#92400e'}}>
              Reserved (cannot be used): /start · /help · /balance · /deposit · /withdraw
            </div>
          </div>

          {/* Custom commands list */}
          {customCommands.length === 0 ? (
            <div style={{textAlign:'center',padding:'32px',background:'white',borderRadius:'12px',border:'1px dashed #e2e8f0'}}>
              <p style={{color:'#94a3b8',fontSize:'13px',margin:0}}>No custom commands yet. Add your first one above.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {customCommands.map((cmd:any) => (
                <div key={cmd.id} style={{
                  background:'white',border:`1px solid ${cmd.is_active?'#e2e8f0':'#f1f5f9'}`,
                  borderRadius:'10px',padding:'12px 14px',opacity:cmd.is_active?1:0.6,
                  display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',flex:1,minWidth:0}}>
                    <code style={{background:'#f1f5f9',padding:'2px 8px',borderRadius:'6px',fontSize:'12px',fontWeight:'600',fontFamily:'monospace',color:'#1e293b',flexShrink:0}}>
                      {cmd.command}
                    </code>
                    <span style={{color:'#64748b',fontSize:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {cmd.response_text.substring(0,80)}{cmd.response_text.length>80?'...':''}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    <button
                      onClick={async()=>{ await supabase.from('bot_commands').update({is_active:!cmd.is_active}).eq('id',cmd.id); await loadCommands() }}
                      style={{padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',background:'white',color:'#64748b',fontSize:'12px',cursor:'pointer'}}
                    >{cmd.is_active?'Disable':'Enable'}</button>
                    <button
                      onClick={()=>deleteCommand(cmd.id, cmd.command)}
                      style={{padding:'4px 10px',border:'1px solid #fecaca',borderRadius:'6px',background:'#fef2f2',color:'#dc2626',fontSize:'12px',cursor:'pointer'}}
                    >Delete</button>
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
import { useToast, ToastContainer } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const RESERVED = ['/start', '/balance', '/deposit', '/withdraw', '/help']
const MAX_RESPONSE = 1000

type BotCommandRow = {
  id: string
  bot_id: string
  command: string
  response_text: string
  is_active: boolean
  created_at: string
}

export default function BotCommandsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId
  const supabase = useMemo(() => createClient(), [])
  const { toasts, removeToast, toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commands, setCommands] = useState<BotCommandRow[]>([])

  const [newCommand, setNewCommand] = useState('')
  const [newResponse, setNewResponse] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCommand, setEditCommand] = useState('')
  const [editResponse, setEditResponse] = useState('')
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: cmdErr } = await supabase
        .from('bot_commands')
        .select('id, bot_id, command, response_text, is_active, created_at')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
      if (cmdErr) throw cmdErr
      setCommands((data as any) || [])
    } catch (e: any) {
      const message = e?.message || 'Failed to load commands'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (botId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId])

  function normalizeCommand(input: string) {
    const trimmed = input.trim()
    const first = trimmed.split(' ')[0]
    return first.toLowerCase()
  }

  function validateCommand(cmd: string, response: string) {
    const c = normalizeCommand(cmd)
    if (!c.startsWith('/')) return 'Command must start with /'
    if (RESERVED.includes(c)) return `Command ${c} is reserved`
    if (!response.trim()) return 'Response cannot be empty'
    if (response.length > MAX_RESPONSE) return `Response must be <= ${MAX_RESPONSE} characters`
    return null
  }

  async function addCommand() {
    const validation = validateCommand(newCommand, newResponse)
    if (validation) {
      toast.error(validation)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const cmd = normalizeCommand(newCommand)
      const newId = crypto.randomUUID()
      const { error: insErr } = await supabase.from('bot_commands').insert({
        id: newId,
        bot_id: botId,
        command: cmd,
        response_text: newResponse.trim(),
        is_active: true
      })
      if (insErr) throw insErr
      toast.success('Command added!')
      setNewCommand('')
      setNewResponse('')
      await load()
    } catch (e: any) {
      const message = e?.message || 'Failed to add command'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: BotCommandRow) {
    setEditLoadingId(row.id)
    setError(null)
    try {
      const { error: upErr } = await supabase
        .from('bot_commands')
        .update({ is_active: !row.is_active })
        .eq('id', row.id)
      if (upErr) throw upErr
      setCommands((prev) => prev.map((c) => (c.id === row.id ? { ...c, is_active: !row.is_active } : c)))
    } catch (e: any) {
      const message = e?.message || 'Failed to update command'
      setError(message)
      toast.error(message)
    } finally {
      setEditLoadingId(null)
    }
  }

  function startEdit(row: BotCommandRow) {
    setEditingId(row.id)
    setEditCommand(row.command)
    setEditResponse(row.response_text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditCommand('')
    setEditResponse('')
  }

  async function saveEdit(rowId: string) {
    const validation = validateCommand(editCommand, editResponse)
    if (validation) {
      toast.error(validation)
      return
    }

    setEditLoadingId(rowId)
    setError(null)
    try {
      const cmd = normalizeCommand(editCommand)
      const { error: upErr } = await supabase
        .from('bot_commands')
        .update({ command: cmd, response_text: editResponse.trim() })
        .eq('id', rowId)
      if (upErr) throw upErr
      toast.success('Command updated!')
      cancelEdit()
      await load()
    } catch (e: any) {
      const message = e?.message || 'Failed to update command'
      setError(message)
      toast.error(message)
    } finally {
      setEditLoadingId(null)
    }
  }

  async function deleteCommand(row: BotCommandRow) {
    const ok = window.confirm(`Are you sure you want to delete ${row.command}?`)
    if (!ok) return

    setEditLoadingId(row.id)
    setError(null)
    try {
      const { error: delErr } = await supabase.from('bot_commands').delete().eq('id', row.id)
      if (delErr) throw delErr
      toast.success('Command deleted!')
      setCommands((prev) => prev.filter((c) => c.id !== row.id))
    } catch (e: any) {
      const message = e?.message || 'Failed to delete command'
      setError(message)
      toast.error(message)
    } finally {
      setEditLoadingId(null)
    }
  }

  const remaining = MAX_RESPONSE - newResponse.length

  return (
    <div style={{ padding: '1.5rem', maxWidth: 920, margin: '0 auto' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 650, color: '#0f172a', margin: 0 }}>Custom Commands</h1>
        <p style={{ marginTop: 6, marginBottom: 0, color: '#475569', fontSize: '0.95rem' }}>
          Add custom slash commands for your bot (example: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>/rules</span>).
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#b91c1c',
            fontSize: '0.9rem'
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 12,
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          color: '#92400e'
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Reserved commands</div>
        <div style={{ fontSize: '0.9rem' }}>
          These commands are built-in and cannot be used:{' '}
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {RESERVED.join(', ')}
          </span>
        </div>
      </div>

      <div
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '1rem',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ fontSize: '0.95rem', fontWeight: 650, color: '#0f172a', marginBottom: '0.75rem' }}>
          Add new command
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Command</label>
            <input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="/rules"
              style={{
                width: '100%',
                marginTop: 6,
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
            <div style={{ marginTop: 6, color: '#64748b', fontSize: '0.85rem' }}>
              Must start with <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>/</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Response</label>
            <textarea
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              placeholder="What should the bot reply?"
              style={{
                width: '100%',
                marginTop: 6,
                minHeight: 120,
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '0.95rem',
                resize: 'vertical'
              }}
            />
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
              <span>Max {MAX_RESPONSE} characters</span>
              <span style={{ color: remaining < 0 ? '#dc2626' : '#64748b' }}>{remaining} remaining</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={addCommand}
              loading={saving}
              loadingText="Adding..."
              disabled={saving}
              variant="primary"
            >
              Add Command
            </Button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '1rem',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)'
        }}
      >
        <div style={{ fontSize: '0.95rem', fontWeight: 650, color: '#0f172a', marginBottom: '0.75rem' }}>
          Existing commands
        </div>

        {loading ? (
          <div style={{ padding: '0.5rem 0', color: '#475569', fontSize: '0.95rem' }}>
            <LoadingSpinner size={18} color="#2563eb" />
            Loading commands...
          </div>
        ) : commands.length === 0 ? (
          <div style={{ padding: '0.5rem 0', color: '#64748b', fontSize: '0.95rem' }}>
            No custom commands yet. Add your first command above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {commands.map((c) => {
              const isEditing = editingId === c.id
              const busy = editLoadingId === c.id
              const preview = c.response_text.length > 100 ? c.response_text.slice(0, 100) + '...' : c.response_text

              return (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '0.9rem',
                    background: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, color: '#0f172a' }}>
                        {c.command}
                      </div>
                      <div style={{ marginTop: 6, color: '#475569', fontSize: '0.92rem', lineHeight: 1.35 }}>
                        {isEditing ? (
                          <>
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Command</label>
                              <input
                                value={editCommand}
                                onChange={(e) => setEditCommand(e.target.value)}
                                style={{
                                  width: '100%',
                                  marginTop: 6,
                                  padding: '0.6rem 0.75rem',
                                  borderRadius: 10,
                                  border: '1px solid #cbd5e1',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Response</label>
                              <textarea
                                value={editResponse}
                                onChange={(e) => setEditResponse(e.target.value)}
                                style={{
                                  width: '100%',
                                  marginTop: 6,
                                  minHeight: 100,
                                  padding: '0.6rem 0.75rem',
                                  borderRadius: 10,
                                  border: '1px solid #cbd5e1',
                                  outline: 'none',
                                  resize: 'vertical'
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          preview
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 650, color: '#334155' }}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: busy ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={c.is_active}
                            disabled={busy}
                            onChange={() => toggleActive(c)}
                            style={{ width: 18, height: 18 }}
                          />
                        </label>
                      </div>

                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button variant="secondary" disabled={busy} onClick={cancelEdit} size="sm">
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            disabled={busy}
                            loading={busy}
                            loadingText="Saving..."
                            onClick={() => saveEdit(c.id)}
                            size="sm"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button variant="secondary" disabled={busy} onClick={() => startEdit(c)} size="sm">
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            disabled={busy}
                            loading={busy}
                            loadingText="Deleting..."
                            onClick={() => deleteCommand(c)}
                            size="sm"
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

