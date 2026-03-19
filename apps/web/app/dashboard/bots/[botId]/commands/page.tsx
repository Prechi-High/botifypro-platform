'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
      const { error: insErr } = await supabase.from('bot_commands').insert({
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

