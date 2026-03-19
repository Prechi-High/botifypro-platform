'use client'

export default function StatusBadge({
  status,
  text
}: {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading'
  text: string
}) {
  const styles: Record<
    'success' | 'error' | 'warning' | 'info' | 'loading',
    { bg: string; color: string; border: string; dot: string }
  > = {
    success: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', dot: '#16a34a' },
    error: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#dc2626' },
    warning: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', dot: '#d97706' },
    info: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', dot: '#2563eb' },
    loading: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', dot: '#64748b' }
  }

  const s = styles[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0.25rem 0.625rem',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: s.color
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.dot,
          animation: status === 'loading' ? 'pulse 1s ease-in-out infinite' : 'none'
        }}
      />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {text}
    </span>
  )
}

