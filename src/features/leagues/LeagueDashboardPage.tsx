import '../../App.css'
import LeagueBottomNav from '../../shared/LeagueBottomNav'

/** Blank league page: only the league navigation for now. */
export default function LeagueDashboardPage({ leagueId }: { leagueId: string }) {
  return (
    <div className="app-shell">
      <LeagueBottomNav leagueId={leagueId} />
    </div>
  )
}
