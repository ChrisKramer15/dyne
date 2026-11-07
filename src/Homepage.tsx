import { useState } from 'react'
import './App.css'
import { ACTIONS, ALERTS_PER_PAGE, SPORTS } from './homeData'

const NAV_ITEMS = [
  { label: 'Home', icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" /> },
  {
    label: 'Leagues',
    icon: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6" />
      </>
    ),
  },
  { label: 'Chat', icon: <path d="M4 5h16v11H9l-5 4z" /> },
  {
    label: 'Profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
  },
]
export default function Homepage() {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(ACTIONS.length / ALERTS_PER_PAGE)
  const visible = ACTIONS.slice(page * ALERTS_PER_PAGE, (page + 1) * ALERTS_PER_PAGE)

  return (
    <div className="landing">
      <main className="home-main">
        <header className="home-header">
          <div className="home-brand">
            <img className="home-logo" src={`${import.meta.env.BASE_URL}dyne-icon.svg`} alt="" aria-hidden="true" />
            <h1 className="wordmark" tabIndex={-1}>
              Dyne
            </h1>
          </div>
        </header>

        <section className="dash-section" aria-labelledby="dash-actions">
          <h2 id="dash-actions" className="dash-heading">
            Alerts
          </h2>
          <ul className="action-list">
            {visible.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`action-item${a.urgent ? ' is-urgent' : ''}`}
                  aria-label={`${a.title}. ${a.detail}`}
                >
                  <span className="action-pic" aria-hidden="true">
                    {a.emoji}
                  </span>
                  <span className="action-text">
                    <span className="action-title">{a.title}</span>
                    <span className="action-detail">{a.detail}</span>
                  </span>
                  <span className="action-cta" aria-hidden="true">
                    {a.cta}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav className="pager" aria-label="Alerts pages">
              <button
                type="button"
                className="pager-btn"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="pager-status" aria-live="polite">
                Page {page + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="pager-btn"
                disabled={page === pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>

        <section className="dash-section" aria-labelledby="dash-join">
          <h2 id="dash-join" className="dash-heading">
            Create or join a league
          </h2>
          <ul className="sport-grid">
            {SPORTS.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className={`sport-card accent-${s.accent}`}
                  aria-label={`Create or join a ${s.name} league`}
                >
                  <span className="sport-pic" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span className="sport-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className="nav-item"
                aria-current={item.label === 'Home' ? 'page' : undefined}
              >
                <span className="nav-bubble" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    {item.icon}
                  </svg>
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
