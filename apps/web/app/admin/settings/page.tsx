'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Eye, EyeOff, Save } from 'lucide-react'
import { hashAdminPassword } from '@/lib/adminAuth'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const BOT_ENGINE_URL = process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)
  const [settingsId, setSettingsId] = useState<string|null>(null)

  // Ad system
  const [minCampaignBudget, setMinCampaignBudget] = useState(20)
  const [adIntervalHours, setAdIntervalHours] = useState(5)
  const [cpm24h, setCpm24h] = useState(1.0)
  const [cpm48h, setCpm48h] = useState(1.0)
  const [cpm72h, setCpm72h] = useState(0.9)
  const [cpm7d, setCpm7d] = useState(0.8)

  // Pro plan OxaPay
  const [proOxapayKey, setProOxapayKey] = useState('')
  const [proOxapayConfigured, setProOxapayConfigured] = useState(false)
  const [showProKey, setShowProKey] = useState(false)

  // Ads OxaPay
  const [adsOxapayKey, setAdsOxapayKey] = useState('')
  const [adsOxapayConfigured, setAdsOxapayConfigured] = useState(false)
  const [showAdsKey, setShowAdsKey] = useState(false)

  // Balance button
  const [balanceButtonText, setBalanceButtonText] = useState('Advertise with AdsGalaxy')
  const [balanceButtonUrl, setBalanceButtonUrl] = useState('https://t.me/Ads_Galaxy_bot')

  // Pricing
  const [proPlanPrice, setProPlanPrice] = useState(10)

  // Admin password
  const [currentAdminPw, setCurrentAdminPw] = useState('')
  const [newAdminPw, setNewAdminPw] = useState('')
  const [confirmAdminPw, setConfirmAdminPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  function notify(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('platform_settings').select('*').single()
      if (data) {
        setSettingsId(data.id)
        setMinCampaignBudget(Number(data.min_campaign_budget_usd||20))
        setAdIntervalHours(Number(data.ad_interval_hours||5))
        setCpm24h(Number(data.cpm_24hr||1.0))
        setCpm48h(Number(data.cpm_48hr||1.0))
        setCpm72h(Number(data.cpm_72hr||0.9))
        setCpm7d(Number(data.cpm_7day||0.8))
        setProOxapayConfigured(Boolean(data.pro_oxapay_merchant_key))
        setAdsOxapayConfigured(Boolean(data.ads_oxapay_merchant_key))
        setBalanceButtonText(data.balance_button_text || 'Advertise with AdsGalaxy')
        setBalanceButtonUrl(data.balance_button_url || 'https://t.me/Ads_Galaxy_bot')
        setProPlanPrice(Number(data.pro_plan_price||10))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      const updates: any = {
        min_campaign_budget_usd: minCampaignBudget,
        ad_interval_hours: adIntervalHours,
        cpm_24hr: cpm24h,
        cpm_48hr: cpm48h,
        cpm_72hr: cpm72h,
        cpm_7day: cpm7d,
        balance_button_text: balanceButtonText,
        balance_button_url: balanceButtonUrl,
        pro_plan_price: proPlanPrice,
      }
      if (proOxapayKey.trim()) {
        updates.pro_oxapay_merchant_key = proOxapayKey.trim()
        updates.pro_oxapay_callback_url = `${BOT_ENGINE_URL}/webhooks/oxapay-pro`
        setProOxapayConfigured(true)
        setProOxapayKey('')
      }
      if (adsOxapayKey.trim()) {
        updates.ads_oxapay_merchant_key = adsOxapayKey.trim()
        updates.ads_oxapay_callback_url = `${BOT_ENGINE_URL}/webhooks/oxapay-ads`
        setAdsOxapayConfigured(true)
        setAdsOxapayKey('')
      }

      if (settingsId) {
        const { error } = await supabase.from('platform_settings').update(updates).eq('id', settingsId)
        if (error) throw error
      } else {
        // Generate ID client-side — Supabase doesn't auto-generate cuid() defaults
        const newId = crypto.randomUUID()
        const { data, error } = await supabase.from('platform_settings').insert({ id: newId, ...updates }).select().single()
        if (error) throw error
        setSettingsId(data.id)
      }
      notify('Settings saved!')
    } catch (e: any) {
      notify(e.message || 'Failed to save', false)
    }
    setSaving(false)
  }

  async function changeAdminPassword() {
    if (!currentAdminPw) { notify('Enter current password', false); return }
    if (!newAdminPw || newAdminPw.length < 6) { notify('New password must be at least 6 characters', false); return }
    if (newAdminPw !== confirmAdminPw) { notify('Passwords do not match', false); return }
    setChangingPw(true)
    try {
      // Verify current password via login endpoint
      const verifyRes = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentAdminPw }),
      })
      if (!verifyRes.ok) { notify('Current password is incorrect', false); setChangingPw(false); return }

      const newHash = hashAdminPassword(newAdminPw)
      const { error } = await supabase.from('platform_settings').update({ admin_password: newHash }).eq('id', settingsId!)
      if (error) throw error
      setCurrentAdminPw(''); setNewAdminPw(''); setConfirmAdminPw('')
      notify('Admin password updated!')
    } catch (e: any) {
      notify(e.message || 'Failed to change password', false)
    }
    setChangingPw(false)
  }

  const label: React.CSSProperties = { display:'block', fontSize:'13px', color:'var(--text-secondary)', fontWeight:500, marginBottom:'6px' }
  const card: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:'14px', padding:'18px', display:'flex', flexDirection:'column', gap:'14px' }
  const sectionTitle: React.CSSProperties = { fontSize:'14px', fontWeight:600, color:'var(--text-primary)', margin:'0 0 2px' }

  if (loading) return <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)' }}>Loading...</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {toast && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:9999, padding:'11px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:500, background:toast.ok?'#f0fdf4':'#fef2f2', border:`1px solid ${toast.ok?'#bbf7d0':'#fecaca'}`, color:toast.ok?'#166534':'#dc2626', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', pointerEvents:'none' }}>{toast.msg}</div>}

      <div>
        <h1 style={{ margin:0, fontSize:'22px', fontWeight:700, color:'var(--text-primary)', fontFamily:"'Space Grotesk', sans-serif", display:'flex', alignItems:'center', gap:'8px' }}>
          <Settings size={20} /> Platform Settings
        </h1>
      </div>

      {/* Ad System */}
      <div style={card}>
        <div><p style={sectionTitle}>Ad System</p><p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>Configure how ads are served across all bots</p></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={label}>Min Campaign Budget (USD)</label><input type="number" value={minCampaignBudget} onChange={e=>setMinCampaignBudget(Number(e.target.value))} className="input-field" /></div>
          <div><label style={label}>Ad Interval (hours per user)</label><input type="number" value={adIntervalHours} onChange={e=>setAdIntervalHours(Number(e.target.value))} className="input-field" /></div>
        </div>
        <div>
          <label style={label}>CPM Rates (cost per 1000 impressions in USD)</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {[['24h Window', cpm24h, setCpm24h],['48h Window', cpm48h, setCpm48h],['72h Window', cpm72h, setCpm72h],['7-Day Window', cpm7d, setCpm7d]].map(([l,v,s])=>(
              <div key={l as string}>
                <label style={{ ...label, marginBottom:'4px' }}>{l as string}</label>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <input type="number" step="0.01" value={v as number} onChange={e=>(s as Function)(Number(e.target.value))} className="input-field" style={{ flex:1 }} />
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>${((v as number)*1000).toFixed(0)}/1k</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OxaPay — Pro Plan Deposits */}
      <div style={card}>
        <div><p style={sectionTitle}>OxaPay — Pro Plan Deposits</p><p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>White-label deposit for bot users activating investment plans</p></div>
        <div>
          <label style={label}>Merchant Key {proOxapayConfigured && <span style={{ color:'#34D399', fontSize:'11px' }}>✓ Configured</span>}</label>
          <div style={{ position:'relative' }}>
            <input type={showProKey?'text':'password'} value={proOxapayKey} onChange={e=>setProOxapayKey(e.target.value)} className="input-field" placeholder={proOxapayConfigured?'••••••••••••':'Paste OxaPay merchant key'} style={{ paddingRight:'44px' }} />
            <button type="button" onClick={()=>setShowProKey(!showProKey)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
              {showProKey?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
        </div>
        <div style={{ background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', color:'var(--text-secondary)', wordBreak:'break-all' }}>
          <div style={{ fontWeight:600, marginBottom:'4px', color:'var(--text-primary)' }}>Auto-generated Callback URL:</div>
          {BOT_ENGINE_URL}/webhooks/oxapay-pro/&#123;botId&#125;
        </div>
      </div>

      {/* OxaPay — Advertising Deposits */}
      <div style={card}>
        <div><p style={sectionTitle}>OxaPay — Advertising Deposits</p><p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>White-label deposit for advertisers topping up their balance</p></div>
        <div>
          <label style={label}>Merchant Key {adsOxapayConfigured && <span style={{ color:'#34D399', fontSize:'11px' }}>✓ Configured</span>}</label>
          <div style={{ position:'relative' }}>
            <input type={showAdsKey?'text':'password'} value={adsOxapayKey} onChange={e=>setAdsOxapayKey(e.target.value)} className="input-field" placeholder={adsOxapayConfigured?'••••••••••••':'Paste OxaPay merchant key'} style={{ paddingRight:'44px' }} />
            <button type="button" onClick={()=>setShowAdsKey(!showAdsKey)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
              {showAdsKey?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
        </div>
        <div style={{ background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', color:'var(--text-secondary)', wordBreak:'break-all' }}>
          <div style={{ fontWeight:600, marginBottom:'4px', color:'var(--text-primary)' }}>Auto-generated Callback URL:</div>
          {BOT_ENGINE_URL}/webhooks/oxapay-ads/&#123;userId&#125;
        </div>
      </div>

      {/* Balance Button */}
      <div style={card}>
        <div><p style={sectionTitle}>Balance Button Customization</p><p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>The inline button shown under every bot's /balance response</p></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={label}>Button Text</label><input value={balanceButtonText} onChange={e=>setBalanceButtonText(e.target.value)} className="input-field" placeholder="Advertise with AdsGalaxy" /></div>
          <div><label style={label}>Button URL</label><input value={balanceButtonUrl} onChange={e=>setBalanceButtonUrl(e.target.value)} className="input-field" placeholder="https://t.me/..." /></div>
        </div>
        <div style={{ padding:'10px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', fontSize:'12px', color:'var(--text-muted)' }}>
          Preview: <a href={balanceButtonUrl} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)', textDecoration:'none' }}>{balanceButtonText}</a>
        </div>
      </div>

      {/* Pricing */}
      <div style={card}>
        <div><p style={sectionTitle}>Pricing</p></div>
        <div style={{ maxWidth:'200px' }}>
          <label style={label}>Pro Plan Price (USD/month)</label>
          <input type="number" min="1" step="1" value={proPlanPrice} onChange={e=>setProPlanPrice(Number(e.target.value))} className="input-field" />
        </div>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'center', padding:'13px', borderRadius:'10px', fontSize:'14px' }}>
        <Save size={15} /> {saving ? 'Saving...' : 'Save All Settings'}
      </button>

      {/* Admin Password */}
      <div style={card}>
        <div><p style={sectionTitle}>Change Admin Password</p><p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>Default password is 123456. Change it after first login.</p></div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <div><label style={label}>Current Password</label><input type="password" value={currentAdminPw} onChange={e=>setCurrentAdminPw(e.target.value)} className="input-field" placeholder="Enter current password" /></div>
          <div><label style={label}>New Password</label><input type="password" value={newAdminPw} onChange={e=>setNewAdminPw(e.target.value)} className="input-field" placeholder="Min 6 characters" /></div>
          <div><label style={label}>Confirm New Password</label><input type="password" value={confirmAdminPw} onChange={e=>setConfirmAdminPw(e.target.value)} className="input-field" placeholder="Repeat new password" /></div>
          <button onClick={changeAdminPassword} disabled={changingPw} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'center' }}>
            {changingPw ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
