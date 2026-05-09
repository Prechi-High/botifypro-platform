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

  const priceLabel = proPlanPrice === null
    ? '...'
    : `$${proPlanPrice}/month`

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Upgrade to Pro
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        Unlock the full power of 1-TouchBot.
      </p>

      <div
        style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Pro Plan —
          </div>
          {proPlanPrice === null ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
          ) : (
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#818cf8' }}>
              {priceLabel}
            </div>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Billed monthly from your advertiser balance
        </div>

        {[
          '14 keyboard buttons per bot (free: 4)',
          '10 required channels per bot (free: 4)',
          'Broadcast to all users',
          'No ads shown in your bots',
          'Priority support',
        ].map((feature) => (
          <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Check size={15} color="#10B981" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{feature}</span>
          </div>
        ))}

        <button
          onClick={() => setShowDeposit(true)}
          disabled={proPlanPrice === null}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '12px',
            background: proPlanPrice === null ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.9)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: proPlanPrice === null ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
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
