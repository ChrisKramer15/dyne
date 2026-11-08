import { useState } from 'react'
import './App.css'
import BottomNav from './BottomNav'
import { ACTIONS, ALERTS_PER_PAGE, SPORTS } from './homeData'


export default function Homepage() {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(ACTIONS.length / ALERTS_PER_PAGE)
  const visible = ACTIONS.slice(page * ALERTS_PER_PAGE, (page + 1) * ALERTS_PER_PAGE)

  return (
    <div className="app-shell">
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
      <BottomNav />
    </div>
  )
}
