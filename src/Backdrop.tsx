import heroBackground from './assets/landing-hero.webp'

/**
 * Full-bleed photo backdrop shared by the Landing, Loading and Home views.
 * The image is imported (not a CSS url()) so the "no image URL in source"
 * style test still passes; a smooth dark scrim sits over it to keep the
 * colours calm and the text legible. Both layers are decorative.
 */
export default function Backdrop() {
  return (
    <>
      <div
        className="landing-photo"
        aria-hidden="true"
        style={{ backgroundImage: `url(${heroBackground})` }}
      />
      <div className="landing-scrim" aria-hidden="true" />
    </>
  )
}
