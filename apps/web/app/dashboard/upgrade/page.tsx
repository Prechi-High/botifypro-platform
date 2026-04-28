'use client'

import { useState } from 'react'
import { Zap, Check } from 'lucide-react'
import DepositModal from '@/components/ui/DepositModal'

export default function UpgradePage() {
  const [showDeposit, setShowDeposit] = useState(false)

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
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Pro Plan - $10/month
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
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '12px',
            background: 'rgba(99,102,241,0.9)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
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
        title="Deposit to Upgrade"
        onSuccess={() => {}}
      />
    </div>
  )
}
