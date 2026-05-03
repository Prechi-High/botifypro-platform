'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { List, RefreshCw, ThumbsUp, Trash2 } from 'lucide-react'

export default function AdminWishlistPage() {
  const supabase = createClient()
  const [wishes, setWishes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('command_wishlist').select('*').order('upvotes', { ascending: false })
    setWishes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteWish(id: string) {
    const { error } = await supabase.from('command_wishlist').delete().eq('id', id)
    if (error) { notify('Failed to delete', false); return }
    notify('Deleted')
    setWishes(prev => prev.filter(w => w.id !== id))
  }

  const statusColors: Record<string,string> = { planned:'#60A5FA', 'in progress':'#FBBF24', done:'#34D399' }
  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>{toast.msg}</div>}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
            <List size={20} /> Command Wishlist
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--text-muted)' }}>{wishes.length} requests</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={card}>
        {loading ? <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} /> :
        wishes.length === 0 ? <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No feature requests yet</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {wishes.map(w => (
              <div key={w.id} style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'12px 14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', flexShrink:0, minWidth:'40px' }}>
                  <ThumbsUp size={14} color="#818cf8" />
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#818cf8' }}>{w.upvotes}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:500, color:'var(--text-primary)', marginBottom:'3px' }}>{w.title}</div>
                  {w.description && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'6px' }}>{w.description}</div>}
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                    {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => deleteWish(w.id)} style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#FCA5A5', fontSize:'11px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
