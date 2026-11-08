import type { AuthService } from '../authService'

/** A top-of-dialog status line: either an error or a success/info note. */
export type Banner = { kind: 'error' | 'success'; text: string } | null

/** Props every auth form receives from the modal shell. */
export interface FormProps {
  /** The headless auth service that performs network calls. */
  service: AuthService
  /** Show (or clear, with null) the dialog's status banner. */
  setBanner: (banner: Banner) => void
  /** Dismiss the dialog. */
  onClose: () => void
  /** Called after a successful sign in or password update. */
  onAuthenticated?: () => void
}
