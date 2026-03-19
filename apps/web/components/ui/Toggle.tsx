'use client'

interface ToggleProps {
  enabled: boolean
  onChange: (val: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export default function Toggle({ enabled, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: enabled ? '#eff6ff' : 'var(--color-background-secondary, #f8fafc)',
      border: `1px solid ${enabled ? '#bfdbfe' : '#e2e8f0'}`,
      borderRadius: '10px',
      marginBottom: '8px',
      transition: 'all 0.2s ease'
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{description}</div>
        )}
      </div>
      <div
        onClick={() => !disabled && onChange(!enabled)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: enabled ? '#2563eb' : '#cbd5e1',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease',
          flexShrink: 0
        }}
      >
        <div style={{
          position: 'absolute',
          top: '3px',
          left: enabled ? '23px' : '3px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s ease'
        }} />
      </div>
    </div>
  )
}
