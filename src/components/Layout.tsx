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
    queryClient.clear()
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

export function ThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light')
  function toggle() {
    const next = !light
    setLight(next)
    if (next) document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem('pwl-theme', next ? 'light' : 'dark')
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }
  return (
    <button className="linkish" onClick={toggle} aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} title="Toggle theme">
      {light ? '☾' : '☀'}
    </button>
  )
}
