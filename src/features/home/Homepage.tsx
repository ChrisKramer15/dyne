import { useMemo } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { ACTIONS, ALERTS_PER_PAGE } from './homeData'
import { RibbonHeading } from './RibbonHeading'
import { Pager } from '../../shared/Pager'
import { usePagination } from '../../shared/usePagination'
import type { LeagueLoader } from '../leagues/leagueLoader'
import { LEAGUE_TYPE_ACCENT, MAX_TOP_LEAGUES } from '../leagues/leaguesData'
import { useMyLeagues } from '../leagues/useMyLeagues'


export default function Homepage({ loader }: { loader?: LeagueLoader } = {}) {
  const { page, pageCount, visible, setPage } = usePagination(ACTIONS, ALERTS_PER_PAGE)
  const { state: mine } = useMyLeagues(loader)
  const topLeagues = useMemo(
    () => (mine.status === 'ready' ? mine.leagues.filter((l) => l.isFavorite).slice(0, MAX_TOP_LEAGUES) : []),
    [mine],
  )

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

        <section className="dash-section" aria-labelledby="dash-top-leagues">
          <RibbonHeading id="dash-top-leagues">Top leagues</RibbonHeading>
          {mine.status === 'error' && <p role="alert">{mine.message}</p>}
          {mine.status === 'ready' &&
            (topLeagues.length > 0 ? (
              <ul className="top-leagues">
                {topLeagues.map((l) => (
                  <li key={l.id}>
                    <Link to={`/leagues/${l.id}`} className={`top-league accent-${LEAGUE_TYPE_ACCENT[l.leagueType]}`} title={l.name}>
                      <span className="top-league-bubble" aria-hidden="true">
                        {l.emoji}
                      </span>
                      <span className="top-league-name">{l.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state top-leagues-empty">
                Add a league to your favorites from the <Link to="/leagues">Leagues page</Link>.
              </p>
            ))}
        </section>

        <section className="dash-section" aria-labelledby="dash-actions">
          <RibbonHeading id="dash-actions">Alerts</RibbonHeading>
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
          <Pager label="Alerts pages" page={page} pageCount={pageCount} onPageChange={setPage} />
        </section>
      </main>
      <BottomNav />
    </div>
  )
}