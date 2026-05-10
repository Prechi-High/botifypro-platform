'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Radio, Send, ImageIcon, Link, X, Upload, Loader2 } from 'lucide-react'
import { ToastContainer, useToast } from '@/components/ui/Toast'

export default function AdminBroadcastPage() {
  const supabase = createClient()
  const { toasts, removeToast, toast } = useToast()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bots, setBots] = useState<any[]>([])
  const [selectedBot, setSelectedBot] = useState<string>('all')
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    supabase.from('bots').select('id, bot_name, bot_username').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setBots(data || []))
  }, [])

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5000000) { toast.error('Image too large. Max 5MB.'); return }
    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `broadcast-${Date.now()}.${fileExt}`
      const { error } = await supabase.storage.from('broadcast-images').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('broadcast-images').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl
      setImageUrl(publicUrl)
      setImagePreview(publicUrl)
      toast.success('Image uploaded ✓')
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message)
    }
    setUploadingImage(false)
  }

  function clearImage() {
    setImageUrl('')
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function send() {
    if (!text.trim()) { toast.error('Enter a message first'); return }
    const target = selectedBot === 'all'
      ? 'ALL bot users across all bots'
      : `users of ${bots.find(b => b.id === selectedBot)?.bot_name || 'selected bot'}`
    if (!confirm(`Send this broadcast to ${target}?`)) return

    setSending(true)
    try {
      const body: any = { text }
      if (imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://'))) {
        body.imageUrl = imageUrl
      }
      if (buttonText && buttonUrl) { body.buttonText = buttonText; body.buttonUrl = buttonUrl }

      const botsToSend = selectedBot === 'all' ? bots : bots.filter(b => b.id === selectedBot)
      let totalSent = 0
      let totalFailed = 0

      for (const bot of botsToSend) {
        try {
          const res = await fetch(`${BOT_ENGINE_URL}/api/bots/${bot.id}/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (data.success) {
            totalSent += data.sent || 0
            totalFailed += data.failed || 0
          }
        } catch {}
      }

      toast.success(`Broadcast sent to ${totalSent} users${totalFailed ? ` (${totalFailed} failed)` : ''}`)
      setHistory(prev => [{
        text, imageUrl: imagePreview, buttonText, buttonUrl,
        target: selectedBot === 'all' ? 'All bots' : bots.find(b => b.id === selectedBot)?.bot_name || 'Bot',
        sent: totalSent, failed: totalFailed, date: new Date().toISOString()
      }, ...prev.slice(0, 9)])
      setText('')
      clearImage()
      setButtonText('')
      setButtonUrl('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to send broadcast')
    }
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={22} color="var(--accent)" /> Broadcast
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
          Send a message to all or specific bot users
        </p>
      </div>

      {/* Compose */}
      <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Target */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Target Audience
          </label>
          <select
            value={selectedBot}
            onChange={e => setSelectedBot(e.target.value)}
            className="input-field"
            style={{ cursor: 'pointer' }}
          >
            <option value="all">All bot users (across all active bots)</option>
            {bots.map(b => (
              <option key={b.id} value={b.id}>{b.bot_name || b.bot_username || b.id}</option>
            ))}
          </select>
        </div>

        {/* Message */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Message
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="input-field"
            style={{ minHeight: '120px', resize: 'vertical', fontSize: '13px' }}
            placeholder="Type your broadcast message here... You can use *bold*, _italic_ or plain text."
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>{text.length} characters</div>
        </div>

        {/* Image */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ImageIcon size={12} /> Image (optional)
          </label>
          {imagePreview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'block' }} />
              <button
                onClick={clearImage}
                style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--red)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={12} color="#fff" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={imageUrl}
                onChange={e => { setImageUrl(e.target.value); setImagePreview(e.target.value) }}
                className="input-field"
                placeholder="Paste image URL (https://...)"
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 'var(--radius-sm)', cursor: uploadingImage ? 'not-allowed' : 'pointer', fontSize: '13px', color: 'var(--accent)', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", width: 'fit-content' }}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} disabled={uploadingImage} />
                {uploadingImage
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...</>
                  : <><Upload size={14} /> Upload Image</>
                }
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>HTTPS URL or upload a file (max 5MB)</div>
            </div>
          )}
        </div>

        {/* Inline Button */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Link size={12} /> Inline Button (optional)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input value={buttonText} onChange={e => setButtonText(e.target.value)} className="input-field" placeholder="Button text" />
            <input value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} className="input-field" placeholder="https://..." />
          </div>
        </div>

        {/* Preview */}
        {text && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Preview
            </label>
            <div style={{ padding: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              {imagePreview && (
                <img src={imagePreview} alt="" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', marginBottom: '8px', display: 'block' }} />
              )}
              <div
                style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
                dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }}
              />
              {buttonText && buttonUrl && (
                <div style={{ marginTop: '10px' }}>
                  <a href={buttonUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: 'inline-block', padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                    {buttonText}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px' }}
        >
          <Send size={15} />
          {sending ? 'Sending...' : 'Send Broadcast'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Recent Broadcasts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{h.target}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
                    {new Date(h.date).toLocaleString()} · {h.sent} sent{h.failed ? `, ${h.failed} failed` : ''}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
