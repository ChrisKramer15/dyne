import { Link } from 'react-router'

/** Rendered for any unknown path. Reads no auth data. */
export default function NotFoundView() {
  return (
    <div className="landing">
      <main>
        <h1 tabIndex={-1}>Page not found</h1>
        <Link to="/">Go to Dyne</Link>
      </main>
    </div>
  )
}
