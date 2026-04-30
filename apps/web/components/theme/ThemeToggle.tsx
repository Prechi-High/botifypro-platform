'use client'

import { Moon, SunMedium } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean
}) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={compact ? 'theme-toggle compact' : 'theme-toggle'}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      {isLight ? <Moon size={16} /> : <SunMedium size={16} />}
      {!compact && <span>{isLight ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  )
}
