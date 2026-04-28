'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PREBUILT_COMMANDS, COMMAND_CATEGORIES } from '@/lib/prebuiltCommands'
import { useToast, ToastContainer } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { Book, PenLine, AlertTriangle } from 'lucide-react'

export default function CommandsPage({ params }: { params: { botId: string } }) {
  const botId = params.botId
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()

  const [activeTab, setActiveTab] = useState<'library' | 'custom'>('library')
  const [selectedCategory, setSelectedCategory] = useState('Universal')
  const [enabledCommands, setEnabledCommands] = useState<any[]>([])
  const [customCommands, setCustomCommands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  
  // Custom command form
  const [newCommand, setNewCommand] = useState('')
  const [newResponse, setNewResponse] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)

  useEffect(() => {
    loadCommands()
  }, [botId])

  async function loadCommands() {
    setLoading(true)
    const { data } = await supabase
      .from('bot_commands')
      .select('*')
      .eq('bot_id', botId)
    if (data) {
      setEnabledCommands(data.filter((c: any) => c.is_prebuilt))
      setCustomCommands(data.filter((c: any) => !c.is_prebuilt))
    }
    setLoading(false)
  }

  function isCommandEnabled(prebuiltKey: string) {
    return enabledCommands.some((c: any) => c.prebuilt_key === prebuiltKey && c.is_active)
  }

  function getEnabledCommand(prebuiltKey: string) {
    return enabledCommands.find((c: any) => c.prebuilt_key === prebuiltKey)
  }

  async function togglePrebuiltCommand(cmd: typeof PREBUILT_COMMANDS[0]) {
    setSaving(cmd.key)
    const existing = getEnabledCommand(cmd.key)

    try {
      if (existing) {
        // Toggle active state
        const { error } = await supabase
          .from('bot_commands')
          .update({ is_active: !existing.is_active })
          .eq('id', existing.id)
        if (error) throw error
        toast.success(existing.is_active ? `${cmd.command} disabled` : `${cmd.command} enabled`)
      } else {
        // Add new command
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
        toast.success(`${cmd.command} enabled!`)
      }
      await loadCommands()
    } catch (err: any) {
      toast.error('Failed to update command: ' + err.message)
    }
    setSaving(null)
  }

  async function updateCommandResponse(commandId: string, newText: string) {
    const { error } = await supabase
      .from('bot_commands')
      .update({ response_text: newText })
      .eq('id', commandId)
    if (!error) toast.success('Response updated!')
    else toast.error('Failed to update')
  }

  async function addCustomCommand() {
    if (!newCommand || !newResponse) return
    setAddingCustom(true)
    const cmd = newCommand.startsWith('/') ? newCommand.toLowerCase() : '/' + newCommand.toLowerCase()
    
    const reserved = ['/start', '/help', '/balance', '/deposit', '/withdraw']
    if (reserved.includes(cmd)) {
      toast.error(`${cmd} is a reserved command and cannot be added`)
      setAddingCustom(false)
      return
    }

    const { error } = await supabase
      .from('bot_commands')
      .insert({
        id: crypto.randomUUID(),
        bot_id: botId,
        command: cmd,
        response_text: newResponse,
        is_active: true,
        command_category: 'custom',
        is_prebuilt: false,
        prebuilt_key: null
      })

    if (error) {
      if (error.message.includes('unique')) {
        toast.error('This command already exists')
      } else {
        toast.error('Failed to add command: ' + error.message)
      }
    } else {
      toast.success('Custom command added!')
      setNewCommand('')
      setNewResponse('')
      await loadCommands()
    }
    setAddingCustom(false)
  }

  async function deleteCommand(commandId: string) {
    const { error } = await supabase
      .from('bot_commands')
      .delete()
      .eq('id', commandId)
    if (!error) {
      toast.success('Command deleted')
      await loadCommands()
    }
  }

  const categoryCommands = PREBUILT_COMMANDS.filter(c => c.category === selectedCategory)

  if (loading) return <div style={{padding:'2rem',color:'var(--color-text-secondary,#64748b)'}}>Loading commands...</div>

  return (
    <div style={{padding:'1.5rem',maxWidth:'900px'}}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontSize:'1.25rem',fontWeight:'600',color:'#1e293b',margin:0}}>Bot Commands</h1>
        <p style={{color:'#64748b',fontSize:'0.875rem',marginTop:'4px'}}>
          Enable pre-built commands or create your own custom commands.
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:'4px',background:'#f1f5f9',borderRadius:'10px',padding:'4px',marginBottom:'1.5rem',width:'fit-content'}}>
        {(['library', 'custom'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding:'7px 16px',
              borderRadius:'8px',
              border:'none',
              background: activeTab === tab ? 'white' : 'transparent',
              color: activeTab === tab ? '#1e293b' : '#64748b',
              fontWeight: activeTab === tab ? '500' : '400',
              fontSize:'0.875rem',
              cursor:'pointer',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition:'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              {tab === 'library' ? <><Book size={16} /> Command Library</> : <><PenLine size={16} /> Custom Commands</>}
            </div>
          </button>
        ))}
      </div>

      {activeTab === 'library' && (
        <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:'1rem'}}>
          
          {/* Category sidebar */}
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
            {COMMAND_CATEGORIES.map(cat => {
              const catCommands = PREBUILT_COMMANDS.filter(c => c.category === cat)
              const enabledCount = catCommands.filter(c => isCommandEnabled(c.key)).length
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding:'8px 12px',
                    borderRadius:'8px',
                    border: selectedCategory === cat ? '1px solid #bfdbfe' : '1px solid transparent',
                    background: selectedCategory === cat ? '#eff6ff' : 'transparent',
                    color: selectedCategory === cat ? '#1d4ed8' : '#475569',
                    fontSize:'0.8rem',
                    fontWeight: selectedCategory === cat ? '500' : '400',
                    cursor:'pointer',
                    textAlign:'left',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center'
                  }}
                >
                  <span>{cat}</span>
                  {enabledCount > 0 && (
                    <span style={{
                      background:'#2563eb',
                      color:'white',
                      borderRadius:'10px',
                      padding:'1px 6px',
                      fontSize:'10px',
                      fontWeight:'600'
                    }}>{enabledCount}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Commands list */}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {categoryCommands.map(cmd => {
              const enabled = isCommandEnabled(cmd.key)
              const existing = getEnabledCommand(cmd.key)
              const isSaving = saving === cmd.key
              
              return (
                <div
                  key={cmd.key}
                  style={{
                    background: enabled ? '#f0fdf4' : 'white',
                    border: `1px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius:'10px',
                    padding:'12px 14px',
                    transition:'all 0.2s'
                  }}
                >
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                        <code style={{
                          background: enabled ? '#dcfce7' : '#f1f5f9',
                          color: enabled ? '#166534' : '#475569',
                          padding:'2px 8px',
                          borderRadius:'6px',
                          fontSize:'0.8rem',
                          fontWeight:'600',
                          fontFamily:'monospace'
                        }}>{cmd.command}</code>
                        {cmd.needsSetup && (
                          <span style={{
                            background:'#fef3c7',
                            color:'#92400e',
                            padding:'1px 7px',
                            borderRadius:'20px',
                            fontSize:'10px',
                            fontWeight:'500'
                          }}>Requires setup</span>
                        )}
                      </div>
                      <p style={{color:'#64748b',fontSize:'0.8rem',margin:0}}>{cmd.description}</p>
                      {cmd.needsSetup && cmd.setupInstructions && (
                        <p style={{color:'#d97706',fontSize:'0.75rem',margin:'4px 0 0',fontStyle:'italic', display: 'flex', gap: '4px'}}>
                          <AlertTriangle size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>{cmd.setupInstructions}</span>
                        </p>
                      )}
                    </div>
                    
                    {/* Toggle */}
                    <div
                      onClick={() => !isSaving && togglePrebuiltCommand(cmd)}
                      style={{
                        width:'40px',
                        height:'22px',
                        borderRadius:'11px',
                        background: enabled ? '#16a34a' : '#cbd5e1',
                        position:'relative',
                        cursor: isSaving ? 'wait' : 'pointer',
                        transition:'background 0.2s',
                        flexShrink:0,
                        marginTop:'2px'
                      }}
                    >
                      <div style={{
                        position:'absolute',
                        top:'3px',
                        left: enabled ? '21px' : '3px',
                        width:'16px',
                        height:'16px',
                        borderRadius:'50%',
                        background:'white',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        transition:'left 0.2s'
                      }} />
                    </div>
                  </div>

                  {/* Editable response when enabled */}
                  {enabled && existing && (
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #dcfce7'}}>
                      <label style={{fontSize:'0.75rem',fontWeight:'500',color:'#166534',display:'block',marginBottom:'4px'}}>
                        Bot response (edit to customise):
                      </label>
                      <textarea
                        defaultValue={existing.response_text}
                        onBlur={(e) => updateCommandResponse(existing.id, e.target.value)}
                        rows={3}
                        style={{
                          width:'100%',
                          padding:'8px',
                          border:'1px solid #bbf7d0',
                          borderRadius:'6px',
                          fontSize:'0.8rem',
                          fontFamily:'monospace',
                          background:'white',
                          resize:'vertical',
                          boxSizing:'border-box'
                        }}
                      />
                      <p style={{color:'#94a3b8',fontSize:'0.7rem',margin:'3px 0 0'}}>
                        Changes save automatically when you click outside the box
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'custom' && (
        <div>
          {/* Add custom command form */}
          <div style={{
            background:'white',
            border:'1px solid #e2e8f0',
            borderRadius:'12px',
            padding:'16px',
            marginBottom:'1.5rem'
          }}>
            <h3 style={{fontSize:'0.9rem',fontWeight:'600',color:'#1e293b',marginBottom:'12px'}}>
              Add Custom Command
            </h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'12px',marginBottom:'10px'}}>
              <div>
                <label style={{fontSize:'0.8rem',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>
                  Command
                </label>
                <input
                  value={newCommand}
                  onChange={e => setNewCommand(e.target.value)}
                  placeholder="/mycommand"
                  style={{
                    width:'100%',
                    padding:'8px 10px',
                    border:'1px solid #e2e8f0',
                    borderRadius:'8px',
                    fontSize:'0.875rem',
                    fontFamily:'monospace',
                    boxSizing:'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{fontSize:'0.8rem',fontWeight:'500',color:'#374151',display:'block',marginBottom:'4px'}}>
                  Response
                </label>
                <input
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="What bot replies when user sends this command"
                  style={{
                    width:'100%',
                    padding:'8px 10px',
                    border:'1px solid #e2e8f0',
                    borderRadius:'8px',
                    fontSize:'0.875rem',
                    boxSizing:'border-box'
                  }}
                />
              </div>
            </div>
            <Button
              onClick={addCustomCommand}
              loading={addingCustom}
              loadingText="Adding..."
              disabled={!newCommand || !newResponse}
              size="sm"
            >
              Add Command
            </Button>
            <div style={{
              marginTop:'10px',
              padding:'8px 12px',
              background:'#fffbeb',
              border:'1px solid #fde68a',
              borderRadius:'6px',
              fontSize:'0.75rem',
              color:'#92400e'
            }}>
              Reserved commands (cannot be used): /start, /help, /balance, /deposit, /withdraw
            </div>
          </div>

          {/* Custom commands list */}
          {customCommands.length === 0 ? (
            <div style={{
              textAlign:'center',
              padding:'2rem',
              background:'white',
              borderRadius:'12px',
              border:'1px dashed #e2e8f0'
            }}>
              <p style={{color:'#94a3b8',fontSize:'0.875rem',margin:0}}>
                No custom commands yet. Add your first one above.
              </p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {customCommands.map((cmd: any) => (
                <div
                  key={cmd.id}
                  style={{
                    background:'white',
                    border:`1px solid ${cmd.is_active ? '#e2e8f0' : '#f1f5f9'}`,
                    borderRadius:'10px',
                    padding:'12px 14px',
                    opacity: cmd.is_active ? 1 : 0.6
                  }}
                >
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <code style={{
                        background:'#f1f5f9',
                        padding:'2px 8px',
                        borderRadius:'6px',
                        fontSize:'0.8rem',
                        fontWeight:'600',
                        fontFamily:'monospace',
                        color:'#1e293b'
                      }}>{cmd.command}</code>
                      <span style={{color:'#64748b',fontSize:'0.8rem'}}>
                        {cmd.response_text.substring(0, 60)}{cmd.response_text.length > 60 ? '...' : ''}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                      <button
                        onClick={async () => {
                          await supabase.from('bot_commands').update({ is_active: !cmd.is_active }).eq('id', cmd.id)
                          await loadCommands()
                        }}
                        style={{
                          padding:'4px 10px',
                          border:'1px solid #e2e8f0',
                          borderRadius:'6px',
                          background:'white',
                          color:'#64748b',
                          fontSize:'0.75rem',
                          cursor:'pointer'
                        }}
                      >
                        {cmd.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${cmd.command}?`)) deleteCommand(cmd.id)
                        }}
                        style={{
                          padding:'4px 10px',
                          border:'1px solid #fecaca',
                          borderRadius:'6px',
                          background:'#fef2f2',
                          color:'#dc2626',
                          fontSize:'0.75rem',
                          cursor:'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
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
