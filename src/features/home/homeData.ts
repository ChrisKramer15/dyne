// Sample data until leagues, drafts and trades are wired to a backend.
export const ACTIONS = [
  { id: 'lineup', emoji: '📝', title: 'Set your lineup', detail: 'Sunday Slugger · locks in 2h', cta: 'Set lineup', urgent: true },
  { id: 'draft', emoji: '🎯', title: 'Draft starts tomorrow', detail: 'Gridiron Gang · 7:00 PM', cta: 'Enter draft room', urgent: false },
  { id: 'waivers', emoji: '🔄', title: 'Waiver claims due tonight', detail: 'Hardwood Heroes · 11:59 PM', cta: 'Review claims', urgent: true },
  { id: 'trade', emoji: '🤝', title: 'Trade offer received', detail: 'From Mike_T in Ice Cold League', cta: 'View offer', urgent: false },
  { id: 'injury', emoji: '🚑', title: 'Player injury update', detail: 'Your SS is day-to-day · Sunday Slugger', cta: 'View player', urgent: true },
  { id: 'invite', emoji: '✉️', title: 'League invite', detail: 'Pit Crew Fantasy · NASCAR', cta: 'Respond', urgent: false },
  { id: 'vote', emoji: '🗳️', title: 'Vote on rule change', detail: 'Ice Cold League · closes Friday', cta: 'Vote', urgent: false },
] as const

/** Alerts shown per page; more than this turns on pagination. */
export const ALERTS_PER_PAGE = 3
/** Sports a user can start or join a league in. */
export const SPORTS = [
  { name: 'Baseball', emoji: '⚾', accent: 'cyan' },
] as const
