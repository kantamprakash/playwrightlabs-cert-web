import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { post } from '../api'
import { useMe } from '../auth'

export const MAIN_SITE = 'https://playwrightlabs.com'

export function Layout() {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await post('/api/auth/logout')
    // Mark the user as signed out so the header updates immediately. (clear() alone empties the
    // cache but leaves mounted components showing the last user they saw.) Then drop everything
    // else that belonged to the previous user, such as the dashboard and admin data.
    queryClient.setQueryData(['me'], null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    navigate('/')
  }

  return (
    <>
      <header className="navbar">
        <div className="container">
          <Link to="/" className="brand">
            <img src="/logo-nav.png" alt="" />
            <span>Playwright Labs</span>
            <small>Certification</small>
          </Link>
          <nav className="nav-links">
            <NavLink to="/verify">Verify</NavLink>
            {me ? (
              <>
                {me.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
                <NavLink to="/dashboard">Dashboard</NavLink>
                <button className="linkish" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <Link to="/register" className="btn small">Register</Link>
              </>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="footer">
        <div className="container spread">
          <span>© {new Date().getFullYear()} Playwright Labs</span>
          <a href={MAIN_SITE}>playwrightlabs.com</a>
        </div>
      </footer>
    </>
  )
}

/** The theme in effect: the visitor's choice if they made one, otherwise the device setting. */
function currentTheme(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('pwl-theme', next)
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {/* Half-filled circle, as used by playwright.dev's toggle. */}
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
    </button>
  )
}
