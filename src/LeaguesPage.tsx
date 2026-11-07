import { useState } from 'react'
import './App.css'
import BottomNav from './BottomNav'
import { LEAGUES, ordinal, type League } from './leaguesData'

const STATUS_LABEL: Record<League['matchup']['status'], string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  final: 'Final',
}

function LeagueCard({ league }: { league: League }) {
  const { matchup: m } = league
  const hasScores = m.myScore !== null && m.theirScore !== null
  const winning = hasScores && m.myScore! > m.theirScore!

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
            <span className={`matchup-score${winning ? ' is-winning' : ''}`}>
              {m.myScore!.toFixed(1)} – {m.theirScore!.toFixed(1)}
            </span>
          ) : (
            <span className="matchup-score">—</span>
          )}
          <span className="matchup-note">{m.note}</span>
        </div>
      </article>
    </li>
  )
}

export default function LeaguesPage() {
  const sports = ['All', ...new Set(LEAGUES.map((l) => l.sport))]
  const [filter, setFilter] = useState('All')
  const shown = filter === 'All' ? LEAGUES : LEAGUES.filter((l) => l.sport === filter)
  const liveCount = LEAGUES.filter((l) => l.matchup.status === 'live').length

  return (
    <div className="landing">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Leagues
          </h1>
        </header>

        <p className="leagues-summary">
          {LEAGUES.length} leagues · {liveCount} live now
        </p>

        <div className="filter-chips" role="group" aria-label="Filter by sport">
          {sports.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <section className="dash-section" aria-labelledby="my-leagues">
          <h2 id="my-leagues" className="dash-heading">
            My leagues
          </h2>
          {shown.length > 0 ? (
            <ul className="league-list">
              {shown.map((l) => (
                <LeagueCard key={l.id} league={l} />
              ))}
            </ul>
          ) : (
            <p className="empty-state">No leagues for this sport yet.</p>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
