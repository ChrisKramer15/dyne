import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import '../../App.css'
import BottomNav from '../../shared/BottomNav'
import { ACTIONS, ALERTS_PER_PAGE, SPORTS } from './homeData'
import { SportIcon } from './SportIcon'
import { Pager } from '../../shared/Pager'
import { usePagination } from '../../shared/usePagination'
import { CreateLeagueWizard } from '../leagues/wizard/CreateLeagueWizard'
import type { LeagueService } from '../leagues/wizard/leagueService'


export interface HomepageProps {
  /** Overrides the app-wide league service used by the wizard. */
  leagueService?: LeagueService
}

export default function Homepage({ leagueService }: HomepageProps = {}) {
  const navigate = useNavigate()
  const [wizard, setWizard] = useState<{ format: string; opener: HTMLElement } | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const { page, pageCount, visible, setPage } = usePagination(ACTIONS, ALERTS_PER_PAGE)

  // After the wizard unmounts, return focus to the opener, or the section heading if it is gone.
  useEffect(() => {
    if (wizard) return
    const opener = restoreFocusRef.current
    if (!opener) return
    restoreFocusRef.current = null
    if (opener.isConnected) opener.focus()
    else document.getElementById('dash-join')?.focus()
  }, [wizard])

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
                      onClick={(e) => setWizard({ format: f.name, opener: e.currentTarget })}
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
          <Pager label="Alerts pages" page={page} pageCount={pageCount} onPageChange={setPage} />
        </section>
      </main>
      <BottomNav />
      {wizard && (
        <CreateLeagueWizard
          format={wizard.format}
          service={leagueService}
          onClose={() => {
            restoreFocusRef.current = wizard.opener
            setWizard(null)
          }}
          onCreated={() => {
            setWizard(null)
            navigate('/leagues')
          }}
        />
      )}
    </div>
  )
}
