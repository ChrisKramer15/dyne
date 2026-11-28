import ConversationViewPage from '../../chat/ConversationViewPage'
import LeagueBottomNav from '../../../shared/LeagueBottomNav'

/** One league conversation (the group chat or a private thread), inside the league. */
export default function LeagueChatConversationPage({
  leagueId,
  conversationId,
}: {
  leagueId: string
  conversationId: string
}) {
  return (
    <ConversationViewPage
      conversationId={conversationId}
      leagueId={leagueId}
      backTo={`/leagues/${leagueId}/chat`}
      backLabel="Back to league chat"
      bottomNav={<LeagueBottomNav leagueId={leagueId} />}
    />
  )
}
