'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('site-theme')
    const nextTheme = storedTheme === 'light' ? 'light' : storedTheme === 'dark' ? 'dark' : initialTheme
    setThemeState(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }, [initialTheme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: (nextTheme) => {
      setThemeState(nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
      window.localStorage.setItem('site-theme', nextTheme)
      document.cookie = `site-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`
    },
    toggleTheme: () => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'
      setThemeState(nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
      window.localStorage.setItem('site-theme', nextTheme)
      document.cookie = `site-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`
    },
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
