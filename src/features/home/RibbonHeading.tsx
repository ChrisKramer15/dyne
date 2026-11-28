import { useContext, type CSSProperties } from 'react'
import { AuthContext } from '../../auth/authContext'
import { accentCss, useAccentColor } from '../profile/accentColor'

/**
 * A home-page section heading drawn on a ribbon. The ribbon follows the accent
 * color the player picked on the profile page (cyan until they pick one).
 */
export function RibbonHeading({ id, children }: { id: string; children: string }) {
  // Read the context directly: some callers render without an auth provider.
  const auth = useContext(AuthContext)
  const { accent } = useAccentColor(auth?.status === 'authenticated' ? auth.userId : undefined)
  return (
    <h2
      id={id}
      className="dash-heading dash-ribbon"
      style={
        accent
          ? ({
              '--ribbon-accent': accentCss(accent.hue),
              // A second hue a little further round the wheel gives the gradient depth.
              '--ribbon-accent-2': accentCss((accent.hue + 40) % 360),
            } as CSSProperties)
          : undefined
      }
    >
      {children}
    </h2>
  )
}
