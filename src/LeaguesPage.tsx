import { useState } from 'react'
import './App.css'
import BottomNav from './BottomNav'
import { LEAGUES, LEAGUES_PER_PAGE, ordinal, type League } from './leaguesData'

const STATUS_LABEL: Record<League['matchup']['status'], string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  final: 'Final',
}

function LeagueCard({ league }: { league: League }) {
  const { matchup: m } = league
  const hasScores = m.myScore !== null && m.theirScore !== null
  const winning = hasScores && m.myScore! > m.theirScore!
  const losing = hasScores && m.myScore! < m.theirScore!

  return (
    <li>
      <article className={`league-card accent-${league.accent}`} aria-labelledby={`league-${league.id}`}>
        <div className="league-top">
          <span className="league-pic" aria-hidden="true">
            {league.emoji}
          </span>
          <div className="league-info">
            <h3 id={`league-${league.id}`} className="league-name">
              {league.name}
            </h3>
            <p className="league-meta">
              {league.sport} · {league.record} · {ordinal(league.rank)} of {league.teams}
            </p>
          </div>
          <span className={`status-badge status-${m.status}`}>{STATUS_LABEL[m.status]}</span>
        </div>

        <div className="matchup">
          <span className="matchup-label">vs {m.opponent}</span>
          {hasScores ? (
            <span className={`matchup-score${winning ? ' is-winning' : ''}${losing ? ' is-losing' : ''}`}>
              {m.myScore!.toFixed(1)} – {m.theirScore!.toFixed(1)}
            </span>
          ) : (
            <span className="matchup-score">—</span>
          )}
          {m.status === 'upcoming' && <span className="matchup-note">{m.note}</span>}
        </div>
      </article>
    </li>
  )
}

export default function LeaguesPage() {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(LEAGUES.length / LEAGUES_PER_PAGE)
  const visible = LEAGUES.slice(page * LEAGUES_PER_PAGE, (page + 1) * LEAGUES_PER_PAGE)
  const liveCount = LEAGUES.filter((l) => l.matchup.status === 'live').length

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Leagues
          </h1>
        </header>

        <p className="leagues-summary">
          {LEAGUES.length} leagues · {liveCount} live now
        </p>

        <section className="dash-section" aria-labelledby="my-leagues">
          <h2 id="my-leagues" className="dash-heading">
            My leagues
          </h2>
          {LEAGUES.length > 0 ? (
            <ul className="league-list">
              {visible.map((l) => (
                <LeagueCard key={l.id} league={l} />
              ))}
            </ul>
          ) : (
            <p className="empty-state">No leagues yet.</p>
          )}
          {pageCount > 1 && (
            <nav className="pager" aria-label="Leagues pages">
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
      </main>
      <BottomNav />
    </div>
  )
}
