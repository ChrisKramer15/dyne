import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { SPORTS } from '../home/homeData'
import { SportIcon } from '../home/SportIcon'
import CreateLeagueWizard, { type WizardFormat } from './wizard/CreateLeagueWizard'
import type { LeagueService } from './wizard/leagueService'
import { getDefaultFavoriteService, TOO_MANY_FAVORITES_MESSAGE, type FavoriteService } from './favoriteService'
import { type LeagueLoader } from './leagueLoader'
import { LEAGUES_PER_PAGE, LEAGUE_TYPE_ACCENT, MAX_TOP_LEAGUES, ordinal, type League } from './leaguesData'
import { useMyLeagues } from './useMyLeagues'
import { Pager } from '../../shared/Pager'
import { usePagination } from '../../shared/usePagination'

const STATUS_LABEL: Record<League['matchup']['status'], string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  final: 'Final',
}

function LeagueCard({ league, onToggleFavorite }: { league: League; onToggleFavorite: (league: League) => void }) {
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
          <button
            type="button"
            className={`favorite-star${league.isFavorite ? ' is-on' : ''}`}
            aria-pressed={league.isFavorite}
            aria-label={league.isFavorite ? `Remove ${league.name} from top leagues` : `Add ${league.name} to top leagues`}
            onClick={() => onToggleFavorite(league)}
          >
            <span aria-hidden="true">{league.isFavorite ? '★' : '☆'}</span>
          </button>
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

export default function LeaguesPage({
  loader,
  favoriteService,
  wizardService,
}: { loader?: LeagueLoader; favoriteService?: FavoriteService; wizardService?: LeagueService } = {}) {
  const [sport, setSport] = useState('all')
  const [wizardFormat, setWizardFormat] = useState<WizardFormat | null>(null)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const { state: mine, reload, patchLeague } = useMyLeagues(loader)
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
  const favoriteCount = allLeagues.filter((l) => l.isFavorite).length

  async function toggleFavorite(league: League) {
    const next = !league.isFavorite
    setFavoriteError(null)
    if (next && favoriteCount >= MAX_TOP_LEAGUES) {
      setFavoriteError(TOO_MANY_FAVORITES_MESSAGE)
      return
    }
    const res = await (favoriteService ?? getDefaultFavoriteService()).setFavorite(league.id, next)
    if (res.ok) patchLeague(league.id, { isFavorite: next })
    else setFavoriteError(res.reason)
  }

  return (
    <div className="app-shell">
      <main className="home-main">
        <header className="home-header">
          <h1 className="wordmark page-title" tabIndex={-1}>
            Leagues
          </h1>
        </header>

        <section className="dash-section" aria-labelledby="dash-join">
          <h2 id="dash-join" tabIndex={-1} className="dash-heading dash-heading-icon">
            <span className="sport-heading-pic" aria-hidden="true">
              {SPORTS[0].emoji}
            </span>
            Create league
          </h2>
          {SPORTS.map((s) => (
            <div key={s.name} className="sport-group">
              <ul className="sport-grid">
                {s.formats.map((f) => (
                  <li key={f.name}>
                    <button
                      type="button"
                      className={`sport-card accent-${f.accent}`}
                      aria-label={`Create a ${f.name} ${s.name} league`}
                      disabled={!f.enabled}
                      onClick={() => setWizardFormat({ name: f.name, sport: s.name, accent: f.accent })}
                    >
                      <span className="sport-icon-wrap">
                        <SportIcon name={f.icon} className="sport-pic" />
                      </span>
                      <span className="sport-text">
                        <span className="sport-name">{f.name}</span>
                        <span className="sport-tagline">{f.tagline}</span>
                      </span>
                      <span className="sport-chevron" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

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
          {favoriteError && <p role="alert">{favoriteError}</p>}
          {leagues.length > 0 ? (
            <ul className="league-list">
              {visible.map((l) => (
                <LeagueCard key={l.id} league={l} onToggleFavorite={(lg) => void toggleFavorite(lg)} />
              ))}
            </ul>
          ) : mine.status === 'ready' && (
            <p className="empty-state">{allLeagues.length > 0 ? 'No leagues for this sport.' : 'No leagues yet.'}</p>
          )}
          <Pager label="Leagues pages" page={page} pageCount={pageCount} onPageChange={setPage} />
        </section>
      </main>
      <BottomNav />
      {wizardFormat && (
        <CreateLeagueWizard
          format={wizardFormat}
          service={wizardService}
          onClose={() => setWizardFormat(null)}
          onCreated={() => {
            setWizardFormat(null)
            reload()
          }}
        />
      )}
    </div>
  )
}