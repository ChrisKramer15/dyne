import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { LEAGUES, LEAGUES_PER_PAGE, LEAGUE_TYPE_ACCENT, ordinal, type League } from './leaguesData'
import { Pager } from '../../shared/Pager'
import { usePagination } from '../../shared/usePagination'

const STATUS_LABEL: Record<League['matchup']['status'], string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  final: 'Final',
}

function LeagueCard({ league }: { league: League }) {
  const { matchup: m } = league
  const scores =
    m.myScore !== null && m.theirScore !== null ? { mine: m.myScore, theirs: m.theirScore } : null
  const winning = scores !== null && scores.mine > scores.theirs
  const losing = scores !== null && scores.mine < scores.theirs

  return (
    <li>
      <article className={`league-card accent-${LEAGUE_TYPE_ACCENT[league.leagueType]}`} aria-labelledby={`league-${league.id}`}>
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
          {scores ? (
            <span className={`matchup-score${winning ? ' is-winning' : ''}${losing ? ' is-losing' : ''}`}>
              {scores.mine.toFixed(1)} – {scores.theirs.toFixed(1)}
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
  const { page, pageCount, visible, setPage } = usePagination(LEAGUES, LEAGUES_PER_PAGE)
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
          <Pager label="Leagues pages" page={page} pageCount={pageCount} onPageChange={setPage} />
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
