import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import { useNavigationGuard, type NavTarget } from './navigation/useNavigationGuard'
import { useAuthState } from './auth/useAuthState'
import { formatWelcome } from './auth/displayName'
import { AuthModal } from './auth/AuthModal'
import { authModalReducer } from './auth/authModalReducer'
import { createAuthService } from './auth/authService'
import { supabase, authStorage } from './supabase'

const noop = () => {}

export interface LandingPageProps {
  onNavigate?: (target: NavTarget) => void
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

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const auth = useAuthState()
  const { guardedNavigate, error } = useNavigationGuard(onNavigate ?? noop)
  const [modal, dispatch] = useReducer(authModalReducer, { open: false })
  const service = useMemo(() => createAuthService(supabase, authStorage), [])
  const openerRef = useRef<Element | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const wasOpen = useRef(false)
  const [rememberFailed, setRememberFailed] = useState(false)

  // Close the modal when a session appears; other statuses never close it.
  useEffect(() => {
    if (auth.status === 'authenticated') dispatch({ type: 'SESSION_CHANGED', authenticated: true })
  }, [auth.status])

  // Return focus to the opener (or the heading if it is gone) after closing.
  useEffect(() => {
    if (wasOpen.current && !modal.open) {
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
      else headingRef.current?.focus()
      openerRef.current = null
    }
    wasOpen.current = modal.open
  }, [modal.open])

  const openModal = (view: 'login' | 'register') => {
    openerRef.current = document.activeElement
    setRememberFailed(false)
    dispatch({ type: 'OPEN', view })
    guardedNavigate(view)
  }
  const [active, setActive] = useState<number | null>(null)
  const current = active === null ? null : FEATURES[active]

  return (
    <>
    <div className="landing" inert={modal.open}>
      <main className="landing-main">
        <h1 className="wordmark" ref={headingRef} tabIndex={-1}>Dyne</h1>
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
              {/* Register: new players */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openModal('register')}
              >
                Register
              </button>
              {/* Login: returning players */}
              <button
                type="button"
                className="btn btn-login"
                onClick={() => openModal('login')}
              >
                Login
              </button>
            </div>
          )}
          {auth.status === 'authenticated' && rememberFailed && (
            <p className="notice" role="status">
              You are signed in, but we could not remember this login.
            </p>
          )}
          <div role="alert">{error && <p className="error">{error}</p>}</div>
        </div>
      </main>
    </div>
    <AuthModal
      state={modal}
      dispatch={dispatch}
      service={service}
      onRememberFailed={() => setRememberFailed(true)}
    />
    </>
  )
}
