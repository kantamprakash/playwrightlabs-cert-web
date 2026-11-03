import { Link } from 'react-router'

export function NotFound() {
  return (
    <main className="container page narrow" style={{ textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link to="/" className="btn">Go home</Link>
    </main>
  )
}
