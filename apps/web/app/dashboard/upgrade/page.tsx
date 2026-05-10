'use client'

import { useEffect, useMemo, useState } from 'react'
import { Zap, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DepositModal from '@/components/ui/DepositModal'

export default function UpgradePage() {
  const supabase = useMemo(() => createClient(), [])
  const [showDeposit, setShowDeposit] = useState(false)
  const [proPlanPrice, setProPlanPrice] = useState<number | null>(null)

  useEffect(() => {
    async function loadPrice() {
      const { data } = await supabase
        .from('platform_settings')
        .select('pro_plan_price')
        .single()
      if (data?.pro_plan_price) {
        setProPlanPrice(Number(data.pro_plan_price))
      } else {
        setProPlanPrice(10)
      }
    }
    loadPrice()
  }, [supabase])

  const priceLabel = proPlanPrice === null ? '...' : `$${proPlanPrice}/month`

  const features = [
    '14 keyboard buttons per bot (free: 4)',
    '10 required channels per bot (free: 4)',
    'Broadcast to all users',
    'No ads shown in your bots',
    'Priority support',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={22} color="var(--accent)" /> Upgrade to Pro
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>
          Unlock the full power of 1-TouchBot.
        </p>
      </div>

      {/* Pro Plan Card */}
      <div className="glass" style={{ padding: '24px' }}>
        {/* Top accent */}
        <div style={{ height: '2px', background: 'var(--accent-gradient)', margin: '-24px -24px 20px', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Pro Plan</span>
              {proPlanPrice === null ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
              ) : (
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {priceLabel}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
              Billed monthly from your advertiser balance
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {features.map((feature) => (
            <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={12} color="var(--accent)" />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>{feature}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowDeposit(true)}
          disabled={proPlanPrice === null}
          className="btn-primary"
          style={{ marginTop: '24px', width: '100%', padding: '13px', borderRadius: 'var(--radius-md)', fontSize: '14px' }}
        >
          <Zap size={16} /> Deposit to Upgrade
        </button>
      </div>

      <DepositModal
        isOpen={showDeposit}
        onClose={() => setShowDeposit(false)}
        title={`Deposit to Upgrade — ${priceLabel}`}
        purpose="upgrade"
        onSuccess={() => {}}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
