import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { RibbonHeading } from '../home/RibbonHeading'
import CreateLeagueWizard from './wizard/CreateLeagueWizard'
import type { LeagueService } from './wizard/leagueService'
import { getDefaultFavoriteService, TOO_MANY_FAVORITES_MESSAGE, type FavoriteService } from './favoriteService'
import { type LeagueLoader } from './leagueLoader'
import { LEAGUES_PER_PAGE, LEAGUE_SPORTS, LEAGUE_TYPE_ACCENT, MAX_TOP_LEAGUES, ordinal, type League } from './leaguesData'
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
              {league.record} · {ordinal(league.rank)} of {league.teams}
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
  const [sport, setSport] = useState<string>(LEAGUE_SPORTS[0].name)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const { state: mine, reload, patchLeague } = useMyLeagues(loader)
  // Only the user's own leagues, in the order the loader returns them (newest first).
  const allLeagues = useMemo<readonly League[]>(() => (mine.status === 'ready' ? mine.leagues : []), [mine])
  const selected = LEAGUE_SPORTS.find((s) => s.name === sport) ?? LEAGUE_SPORTS[0]
  const leagues = useMemo(() => allLeagues.filter((l) => l.sport === sport), [allLeagues, sport])
  const { page, pageCount, visible, setPage } = usePagination(leagues, LEAGUES_PER_PAGE)
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

        <section className="dash-section" aria-labelledby="dash-sport">
          <RibbonHeading id="dash-sport">Sport Category</RibbonHeading>
          <ul className="sport-picker">
            {LEAGUE_SPORTS.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className={`sport-pick accent-${s.accent}`}
                  aria-pressed={s.name === sport}
                  onClick={() => {
                    setSport(s.name)
                    setPage(0)
                  }}
                >
                  <span className="sport-pick-emoji" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span className="sport-pick-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {!selected.available && (
            <p className={`coming-soon accent-${selected.accent}`} role="status">
              Coming Soon!
            </p>
          )}
        </section>

        {selected.available && (
        <section className="dash-section" aria-labelledby="my-leagues">
          <div className="section-head">
            <RibbonHeading id="my-leagues">My leagues</RibbonHeading>
            <button type="button" className="create-league-btn" onClick={() => setWizardOpen(true)}>
              <span className="create-league-plus" aria-hidden="true">+</span>
              Create league
            </button>
          </div>
          <Pager label="Leagues pages" page={page} pageCount={pageCount} onPageChange={setPage} />
          {mine.status === 'loading' && <p role="status">Loading your leagues…</p>}
          {mine.status === 'error' && <p role="alert">{mine.message}</p>}
          {favoriteError && <p className="favorite-error" role="alert">{favoriteError}</p>}
          {leagues.length > 0 ? (
            <ul className="league-list">
              {visible.map((l) => (
                <LeagueCard key={l.id} league={l} onToggleFavorite={(lg) => void toggleFavorite(lg)} />
              ))}
            </ul>
          ) : mine.status === 'ready' && (
            <p className="empty-state">No {selected.name.toLowerCase()} leagues yet.</p>
          )}
        </section>
        )}

      </main>
      <BottomNav />
      {wizardOpen && (
        <CreateLeagueWizard
          sport={sport}
          service={wizardService}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}
