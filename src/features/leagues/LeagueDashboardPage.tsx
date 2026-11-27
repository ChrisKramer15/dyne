import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import '../../App.css'
import { AuthContext } from '../../auth/authContext'
import { getDisplayName, truncateName } from '../../auth/displayName'
import BottomNav from '../../shared/BottomNav'
import NotFoundView from '../../routing/NotFoundView'
import { getDefaultLeagueDetailLoader, type LeagueDetail, type LeagueDetailLoader } from './leagueDetailLoader'
import { LEAGUE_TYPE_ACCENT } from './leaguesData'
import { SCORING_CATEGORIES } from './wizard/scoringSettings'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'My team' },
  { id: 'matchup', label: 'Matchup' },
  { id: 'standings', label: 'Standings' },
  { id: 'settings', label: 'Settings' },
] as const
type TabId = (typeof TABS)[number]['id']

type DetailState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; league: LeagueDetail }

/** Loads the league on mount and whenever the id changes. */
function useLeague(id: string, loader: LeagueDetailLoader | undefined): DetailState {
  const [state, setState] = useState<{ id: string; value: DetailState }>({ id, value: { status: 'loading' } })
  useEffect(() => {
    let cancelled = false
    void (loader ?? getDefaultLeagueDetailLoader()).loadLeague(id).then((res) => {
      if (cancelled) return
      setState({
        id,
        value: res.ok
          ? { status: 'ready', league: res.league }
          : res.reason === 'not_found'
            ? { status: 'not_found' }
            : { status: 'error', message: res.message },
      })
    })
    return () => {
      cancelled = true
    }
  }, [id, loader])
  // Show the spinner, not the previous league, while a different id loads.
  return state.id === id ? state.value : { status: 'loading' }
}

function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="ld-card" aria-labelledby={id}>
      <h3 id={id} className="ld-card-title">
        {title}
      </h3>
      {children}
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ld-info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function StandingsTable({ league, teamName, preview = false }: { league: LeagueDetail; teamName: string; preview?: boolean }) {
  const open = league.teamCount - league.memberCount
  return (
    <>
      <table className="ld-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col">W-L</th>
            <th scope="col">PF</th>
          </tr>
        </thead>
        <tbody>
          <tr className="is-me">
            <td>1</td>
            <th scope="row">{teamName}</th>
            <td>0-0</td>
            <td>0.0</td>
          </tr>
          {!preview &&
            Array.from({ length: open }, (_, i) => (
              <tr key={i} className="is-open">
                <td>{league.memberCount + i + 1}</td>
                <th scope="row">Open spot</th>
                <td>–</td>
                <td>–</td>
              </tr>
            ))}
        </tbody>
      </table>
      {open > 0 && (
        <p className="ld-note">
          {open} open {open === 1 ? 'spot' : 'spots'} · standings fill in once teams join and the season starts.
        </p>
      )}
    </>
  )
}

function MatchupCard({ teamName }: { teamName: string }) {
  return (
    <div className="ld-scoreboard">
      <div className="ld-side">
        <span className="ld-side-name">{teamName}</span>
        <span className="ld-side-score">0.0</span>
      </div>
      <span className="ld-vs">vs</span>
      <div className="ld-side is-right">
        <span className="ld-side-name">TBD</span>
        <span className="ld-side-score">0.0</span>
      </div>
    </div>
  )
}

function ScoringSummary({ league }: { league: LeagueDetail }) {
  const groups = SCORING_CATEGORIES.map((c) => ({
    ...c,
    stats: c.stats.filter((s) => league.scoring[s.key] !== undefined),
  })).filter((c) => c.stats.length > 0)
  if (groups.length === 0) return <p className="empty-state">No scoring settings saved.</p>
  return (
    <div className="ld-scoring">
      {groups.map((c) => (
        <div key={c.id}>
          <h4 className="ld-subtitle">{c.title}</h4>
          <ul className="ld-stat-list">
            {c.stats.map((s) => (
              <li key={s.key}>
                <span title={s.label}>{s.label}</span>
                <strong>{formatPoints(league.scoring[s.key])}</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function formatPoints(n: number): string {
  return `${n > 0 ? '+' : ''}${n}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function LeagueInfo({ league }: { league: LeagueDetail }) {
  return (
    <dl className="ld-info">
      <InfoRow label="Format" value={league.leagueType} />
      <InfoRow label="Sport" value={league.sport} />
      <InfoRow label="Teams" value={`${league.memberCount} of ${league.teamCount} joined`} />
      <InfoRow label="Commissioner" value={league.isCommissioner ? 'You' : 'Another member'} />
      <InfoRow label="Created" value={formatDate(league.createdAt)} />
    </dl>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>
}

function TabPanel({ tab, league, teamName }: { tab: TabId; league: LeagueDetail; teamName: string }) {
  switch (tab) {
    case 'overview':
      return (
        <div className="ld-grid">
          <Card id="ld-status" title="Season status">
            <p className="ld-status">
              <span className="status-badge status-upcoming">Preseason</span>
              <span>The season has not started. Draft date to be announced.</span>
            </p>
          </Card>
          <Card id="ld-matchup" title="This week's matchup">
            <MatchupCard teamName={teamName} />
            <p className="ld-note">Matchups appear once the schedule is set.</p>
          </Card>
          <Card id="ld-standings" title="Standings">
            <StandingsTable league={league} teamName={teamName} preview />
          </Card>
          <Card id="ld-activity" title="Recent activity">
            <Empty>No activity yet. Trades, waivers and draft picks will show up here.</Empty>
          </Card>
          <Card id="ld-info" title="League info">
            <LeagueInfo league={league} />
          </Card>
        </div>
      )
    case 'team':
      return (
        <Card id="ld-team" title="My team">
          <Empty>Your roster will appear here after the draft.</Empty>
        </Card>
      )
    case 'matchup':
      return (
        <Card id="ld-matchup-full" title="Matchup">
          <MatchupCard teamName={teamName} />
          <Empty>Head-to-head player scoring appears once the season starts.</Empty>
        </Card>
      )
    case 'standings':
      return (
        <Card id="ld-standings-full" title="Standings">
          <StandingsTable league={league} teamName={teamName} />
        </Card>
      )
    case 'settings':
      return (
        <div className="ld-grid">
          <Card id="ld-settings-info" title="League info">
            <LeagueInfo league={league} />
          </Card>
          <Card id="ld-settings-scoring" title="Scoring">
            <ScoringSummary league={league} />
          </Card>
        </div>
      )
  }
}

function Tabs({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <div className="ld-tabs" role="tablist" aria-label="League sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`ld-tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls="ld-panel"
          tabIndex={active === t.id ? 0 : -1}
          className="ld-tab"
          onClick={() => onSelect(t.id)}
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (dir === 0) return
            e.preventDefault()
            const next = TABS[(TABS.findIndex((x) => x.id === t.id) + dir + TABS.length) % TABS.length]
            onSelect(next.id)
            document.getElementById(`ld-tab-${next.id}`)?.focus()
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function LeagueDashboardPage({ leagueId, loader }: { leagueId: string; loader?: LeagueDetailLoader }) {
  const detail = useLeague(leagueId, loader)
  const [tab, setTab] = useState<TabId>('overview')
  const auth = useContext(AuthContext)
  const name = auth?.status === 'authenticated' ? getDisplayName(auth.userMetadata) : ''
  const teamName = name === '' ? 'My team' : `${truncateName(name)}'s team`

  if (detail.status === 'not_found') return <NotFoundView />

  const league = detail.status === 'ready' ? detail.league : null
  return (
    <div className="app-shell">
      <main className="home-main">
        <Link to="/leagues" className="ld-back">
          ← Leagues
        </Link>
        {detail.status === 'loading' && <p role="status">Loading league…</p>}
        {detail.status === 'error' && <p role="alert">{detail.message}</p>}
        {league && (
          <>
            <header className={`ld-header accent-${LEAGUE_TYPE_ACCENT[league.leagueType]}`}>
              <div className="ld-avatar" aria-hidden="true">
                {league.emoji}
              </div>
              <div className="ld-heading">
                <h1 className="ld-title" tabIndex={-1}>
                  {league.name}
                </h1>
                <p className="ld-sub">
                  {league.sport} · {league.leagueType} · {league.teamCount} teams
                </p>
              </div>
            </header>
            <Tabs active={tab} onSelect={setTab} />
            <div id="ld-panel" role="tabpanel" aria-labelledby={`ld-tab-${tab}`}>
              <TabPanel tab={tab} league={league} teamName={teamName} />
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
