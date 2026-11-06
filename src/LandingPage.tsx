import { useMemo, useState, type CSSProperties } from 'react'
import './App.css'
import heroBackground from './assets/landing-hero.webp'
import { useAuthState } from './auth/useAuthState'
import { formatWelcome } from './auth/displayName'
import AuthModal, { type AuthMode } from './auth/AuthModal'
import { createAuthService, type AuthService } from './auth/authService'
import { supabase, authStorage } from './supabase'

// The Register/Login buttons open the auth modal (login / register / reset).
// `onNavigate` is retained so callers that pass it keep compiling; it is no
// longer used now that auth happens in an in-page modal.
export interface LandingPageProps {
  onNavigate?: (target: 'login' | 'register') => void
  /** Injectable for tests; defaults to the real Supabase-backed service. */
  authService?: AuthService
}

// Small square base centred on (x, y), rotated 45° to sit on the base paths.
const base = (x: number, y: number) => `M${x} ${y - 3.2}l3.2 3.2-3.2 3.2-3.2-3.2z`

// Decorative bubble mark: a dark glass sphere with a neon rim holding a
// top-down baseball field. Home plate sits at (48, 74); the foul lines run out
// to the outfield wall, an arc centred on home plate. Hidden from assistive
// tech; the h1 carries the name.
function BubbleIcon() {
  return (
    <svg className="bubble" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bubble-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(185 100% 60%)" />
          <stop offset="0.55" stopColor="hsl(130 100% 55%)" />
          <stop offset="1" stopColor="hsl(315 100% 60%)" />
        </linearGradient>
        <radialGradient id="bubble-shine" cx="0.32" cy="0.24" r="0.42">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Dark glass body, soft highlight, neon rim */}
      <circle className="bubble-body" cx="48" cy="48" r="44" />
      <circle cx="48" cy="48" r="44" fill="url(#bubble-shine)" />
      <circle cx="48" cy="48" r="43" fill="none" stroke="url(#bubble-rim)" strokeWidth="2" />

      <g className="field">
        {/* Outfield wall and foul lines */}
        <path className="field-outfield" d="M16 42A45.25 45.25 0 0 1 80 42L48 74Z" />
        {/* Base paths */}
        <path className="field-diamond" d="M48 74L65 57L48 40L31 57Z" />
        {/* Pitcher's mound */}
        <circle className="field-mound" cx="48" cy="57" r="2.6" />
        {/* First, second and third base, then home plate */}
        <path className="field-base" d={base(65, 57) + base(48, 40) + base(31, 57)} />
        <path className="field-base" d="M44.6 71.2h6.8v3.4L48 78l-3.4-3.4z" />
      </g>
    </svg>
  )
}

// Neon accents; each maps to a .accent-* class that sets --accent.
type Accent = 'cyan' | 'green' | 'magenta' | 'purple'

type BaseId = 'first' | 'second' | 'third' | 'home'

interface Feature {
  base: BaseId
  title: string
  text: string
  accent: Accent
}

// Features in the order a runner circles the bases: first, second, third,
// then home. Coming home is how you win, so the title sits on home plate.
const FEATURES: readonly Feature[] = [
  {
    base: 'first',
    title: 'Own Draft Day',
    text: 'Live rankings to build a roster your league will fear.',
    accent: 'cyan',
  },
  {
    base: 'second',
    title: 'Every Pitch, Live',
    text: 'Watch your matchup swing in real time as runs, Ks and steals roll in.',
    accent: 'green',
  },
  {
    base: 'third',
    title: 'Work the Wire',
    text: 'Snag breakout bats off waivers and swing trades first.',
    accent: 'magenta',
  },
  {
    base: 'home',
    title: 'Claim the Crown',
    text: 'Climb the standings, clinch the title and keep the bragging rights.',
    accent: 'purple',
  },
]

// Shown under the field when no base is selected.
const TAGLINE = 'Fantasy baseball, played every pitch.'

// Base positions as percentages of the square field, matching the SVG below
// (viewBox 0 0 100 100).
const BASE_POS: Record<BaseId, { x: number; y: number }> = {
  first: { x: 84, y: 52 },
  second: { x: 50, y: 18 },
  third: { x: 16, y: 52 },
  home: { x: 50, y: 86 },
}

/** The playing field: outfield wall, foul lines and base paths. Decorative. */
function FieldLines() {
  return (
    <svg className="field-lines" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {/* Outfield wall: an arc centred on home plate, plus the foul lines */}
      <path
        className="field-wall"
        d="M50 86L-3.7 32.3M50 86L103.7 32.3M-3.7 32.3A76 76 0 0 1 103.7 32.3"
      />
      {/* Infield grass tint and base paths, drawn home -> 1st -> 2nd -> 3rd */}
      <path className="field-infield" d="M50 86L84 52L50 18L16 52Z" />
      <path className="field-paths" d="M50 86L84 52L50 18L16 52Z" pathLength={1} />
    </svg>
  )
}

interface BaseProps {
  feature: Feature
  index: number
  active: boolean
  onActivate: () => void
  onDeactivate: () => void
}

function Base({ feature, index, active, onActivate, onDeactivate }: BaseProps) {
  const { x, y } = BASE_POS[feature.base]
  const descId = `base-desc-${feature.base}`
  return (
    <li
      className={`base base-${feature.base} accent-${feature.accent}${active ? ' is-active' : ''}`}
      style={{ '--x': `${x}%`, '--y': `${y}%`, '--i': index } as CSSProperties}
    >
      <button
        type="button"
        className="base-btn"
        aria-describedby={descId}
        // Mouse: hover previews. Touch and keyboard: tap or focus selects,
        // and it stays until focus moves elsewhere.
        onPointerEnter={(e) => e.pointerType === 'mouse' && onActivate()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onDeactivate()}
        onFocus={onActivate}
        onBlur={onDeactivate}
        onClick={onActivate}
      >
        <span className="base-marker" aria-hidden="true" />
        <span className="base-label">{feature.title}</span>
      </button>
      {/* Read by screen readers as the button's description */}
      <span id={descId} className="visually-hidden">
        {feature.text}
      </span>
    </li>
  )
}

export default function LandingPage({ authService }: LandingPageProps) {
  const auth = useAuthState()
  const [active, setActive] = useState<number | null>(null)
  const current = active === null ? null : FEATURES[active]
  const [modalMode, setModalMode] = useState<AuthMode | null>(null)

  // A password-reset link lands the user here in a "recovering" session. Force
  // the update-password form open so they can set a new password; it cannot be
  // dismissed back into a half-signed-in state (see onClose below).
  const recovering = auth.status === 'recovering'
  const effectiveMode: AuthMode | null = recovering ? 'update-password' : modalMode

  // Build the real service lazily so importing this component never forces the
  // Supabase client (and its env-var check) to initialise — tests that mock
  // auth state and never open the modal must not need Supabase configured.
  const service = useMemo<AuthService | null>(() => {
    if (authService) return authService
    if (effectiveMode === null) return null
    return createAuthService(supabase, authStorage)
  }, [authService, effectiveMode])

  return (
    <div className="landing">
      {/* Full-bleed photo backdrop. The image is imported (not a CSS url())
          so the "no image URL in source" style test still passes; a smooth
          dark scrim sits over it to keep the colours calm and the text legible. */}
      <div
        className="landing-photo"
        aria-hidden="true"
        style={{ backgroundImage: `url(${heroBackground})` }}
      />
      <div className="landing-scrim" aria-hidden="true" />
      <main className="landing-main">
        <h1 className="wordmark" tabIndex={-1}>Dyne</h1>
        {/* The visible tagline below is decorative; this copy is for screen readers */}
        <p className="visually-hidden">{TAGLINE}</p>

        <section className="diamond" aria-label="Why Dyne">
          <FieldLines />
          {/* The logo sits on the pitcher's mound */}
          <div className="mound">
            <BubbleIcon />
          </div>
          <ul className="bases">
            {FEATURES.map((feature, i) => (
              <Base
                key={feature.base}
                feature={feature}
                index={i}
                active={active === i}
                onActivate={() => setActive(i)}
                onDeactivate={() => setActive((a) => (a === i ? null : a))}
              />
            ))}
          </ul>
        </section>

        {/* Visual echo of the selected base's description (screen readers get
            it via aria-describedby instead, so this is hidden from them). */}
        <p
          className={`pitch${current ? ` accent-${current.accent} has-feature` : ''}`}
          aria-hidden="true"
        >
          {current ? current.text : TAGLINE}
        </p>

        {/* Fixed-height slot so the page doesn't jump when auth resolves */}
        <div className="cta">
          {auth.status === 'loading' && (
            <p className="loading" role="status">
              Loading…
            </p>
          )}
          {auth.status === 'authenticated' && (
            <p className="welcome">{formatWelcome(auth.userMetadata)}</p>
          )}
          {auth.status === 'unauthenticated' && (
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalMode('register')}
              >
                Register
              </button>
              <button
                type="button"
                className="btn btn-login"
                onClick={() => setModalMode('login')}
              >
                Login
              </button>
            </div>
          )}
        </div>
      </main>

      {effectiveMode !== null && service && (
        <AuthModal
          mode={effectiveMode}
          service={service}
          // During recovery the modal must stay put until the password is
          // saved; closing would leave an unusable recovery session. Otherwise
          // dismissing just clears the chosen mode.
          onClose={() => {
            if (!recovering) setModalMode(null)
          }}
        />
      )}
    </div>
  )
}
