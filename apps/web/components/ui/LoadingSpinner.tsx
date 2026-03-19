'use client'

export default function LoadingSpinner({
  size = 20,
  color = '#2563eb'
}: {
  size?: number
  color?: string
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}20`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        verticalAlign: 'middle',
        marginRight: '6px'
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </span>
  )
}

