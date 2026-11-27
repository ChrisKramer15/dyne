import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { getDefaultLeagueLoader, type LeagueLoader } from './leagueLoader'
import { LEAGUES_PER_PAGE, LEAGUE_TYPE_ACCENT, ordinal, type League } from './leaguesData'
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
        <div className="league-pic" aria-hidden="true">
          {league.emoji}
        </div>
        <div className="league-body">
        <div className="league-top">
          <div className="league-info">
            <h3 id={`league-${league.id}`} className="league-name">
              <Link to={`/leagues/${league.id}`} className="league-link">{league.name}</Link>
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
        </div>
      </article>
    </li>
  )
}

type MyLeagues =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; leagues: readonly League[] }

/** Loads the signed-in user's leagues on every mount, so a new league shows up right away. */
function useMyLeagues(loader: LeagueLoader | undefined): MyLeagues {
  const [state, setState] = useState<MyLeagues>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    void (loader ?? getDefaultLeagueLoader()).loadMyLeagues().then((res) => {
      if (cancelled) return
      setState(res.ok ? { status: 'ready', leagues: res.leagues } : { status: 'error', message: res.reason })
    })
    return () => {
      cancelled = true
    }
  }, [loader])
  return state
}

export default function LeaguesPage({ loader }: { loader?: LeagueLoader } = {}) {
  const [sport, setSport] = useState('all')
  const mine = useMyLeagues(loader)
  // Only the user's own leagues, in the order the loader returns them (newest first).
  const allLeagues = useMemo<readonly League[]>(() => (mine.status === 'ready' ? mine.leagues : []), [mine])
  const sports = useMemo(
    () => [...new Set(allLeagues.map((l) => l.sport))].sort((a, b) => a.localeCompare(b)),
    [allLeagues],
  )
  const leagues = useMemo(
    () => allLeagues.filter((l) => sport === 'all' || l.sport === sport),
    [allLeagues, sport],
  )
  const { page, pageCount, visible, setPage } = usePagination(leagues, LEAGUES_PER_PAGE)
  const liveCount = leagues.filter((l) => l.matchup.status === 'live').length

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Leagues
          </h1>
        </header>

        <p className="leagues-summary">
          {leagues.length} leagues · {liveCount} live now
        </p>

        <section className="dash-section" aria-labelledby="my-leagues">
          <h2 id="my-leagues" className="dash-heading">
            My leagues
          </h2>
            <div className="league-filter">
              <label htmlFor="sport-filter">Sport</label>
              <select
                id="sport-filter"
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value)
                  setPage(0)
                }}
              >
                <option value="all">All sports</option>
                {sports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          {mine.status === 'loading' && <p role="status">Loading your leagues…</p>}
          {mine.status === 'error' && <p role="alert">{mine.message}</p>}
          {leagues.length > 0 ? (
            <ul className="league-list">
              {visible.map((l) => (
                <LeagueCard key={l.id} league={l} />
              ))}
            </ul>
          ) : mine.status === 'ready' && (
            <p className="empty-state">{allLeagues.length > 0 ? 'No leagues for this sport.' : 'No leagues yet.'}</p>
          )}
          <Pager label="Leagues pages" page={page} pageCount={pageCount} onPageChange={setPage} />
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
