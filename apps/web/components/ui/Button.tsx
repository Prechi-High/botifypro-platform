'use client'

import type { ReactNode } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  loading?: boolean
  loadingText?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: { bg: 'var(--button-primary-bg)', hover: 'var(--button-primary-bg)', text: 'var(--button-primary-text)' },
  secondary: { bg: 'var(--bg-elevated)', hover: 'var(--surface-hover)', text: 'var(--text-primary)' },
  danger: { bg: '#dc2626', hover: '#b91c1c', text: 'white' },
  success: { bg: '#16a34a', hover: '#15803d', text: 'white' }
}

const sizes = {
  sm: { padding: '0.4rem 0.75rem', fontSize: '0.8rem' },
  md: { padding: '0.6rem 1rem', fontSize: '0.875rem' },
  lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' }
}

export default function Button({
  children,
  onClick,
  type = 'button',
  loading = false,
  loadingText,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  size = 'md'
}: ButtonProps) {
  const v = variants[variant]
  const s = sizes[size]
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: s.padding,
        background: isDisabled ? 'color-mix(in srgb, var(--text-secondary) 35%, transparent)' : v.bg,
        color: v.text,
        border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
        borderRadius: '8px',
        fontSize: s.fontSize,
        fontWeight: '500',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        transition: 'background 0.15s ease, transform 0.1s ease, box-shadow 0.2s ease',
        transform: 'scale(1)',
        boxShadow: variant === 'primary' && !isDisabled ? '0 0 18px rgba(74,222,128,0.2)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.background = v.hover
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.background = v.bg
      }}
      onMouseDown={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.transform = 'scale(0.97)'
      }}
      onMouseUp={(e) => {
        if (!isDisabled) (e.target as HTMLButtonElement).style.transform = 'scale(1)'
      }}
    >
      {loading && <LoadingSpinner size={16} color={v.text} />}
      {loading ? loadingText || 'Loading...' : children}
    </button>
  )
}

