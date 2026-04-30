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
      background: enabled ? 'var(--blue-glow)' : 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
      border: `1px solid ${enabled ? 'var(--border-active)' : 'var(--border)'}`,
      borderRadius: '10px',
      marginBottom: '8px',
      transition: 'all 0.2s ease'
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{description}</div>
        )}
      </div>
      <div
        onClick={() => !disabled && onChange(!enabled)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: enabled ? 'var(--blue-primary)' : 'color-mix(in srgb, var(--text-secondary) 40%, transparent)',
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
