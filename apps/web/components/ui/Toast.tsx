'use client'

import { useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

const toastStyles: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#16a34a', color: '#15803d', icon: '✓' },
  error: { bg: '#fef2f2', border: '#dc2626', color: '#dc2626', icon: '✕' },
  warning: { bg: '#fffbeb', border: '#d97706', color: '#b45309', icon: '⚠' },
  info: { bg: '#eff6ff', border: '#2563eb', color: '#1d4ed8', icon: 'ℹ' }
}

export function ToastContainer({
  toasts,
  onRemove
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}
    >
      {toasts.map((toast) => {
        const s = toastStyles[toast.type]
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: '280px',
              animation: 'slideIn 0.2s ease',
              color: s.color,
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
            <span style={{ fontSize: '1rem' }}>{s.icon}</span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => onRemove(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: s.color,
                fontSize: '1rem',
                padding: 0
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const addToast = (type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString(16).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => removeToast(id), 4000)
  }

  return {
    toasts,
    addToast,
    removeToast,
    toast: {
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      warning: (msg: string) => addToast('warning', msg),
      info: (msg: string) => addToast('info', msg)
    }
  }
}

