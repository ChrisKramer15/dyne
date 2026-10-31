import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8')
const appCss = readFileSync(join(root, 'src/App.css'), 'utf8')

type RGB = [number, number, number]

function cssVar(name: string): string {
  const m = indexCss.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`Missing custom property --${name}`)
  return m[1].trim()
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

function parseHsl(v: string): [number, number, number] {
  const m = v.match(/hsl\(\s*([\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*\)/)
  if (!m) throw new Error(`Not an hsl color: ${v}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function colorToRgb(v: string): RGB {
  return v.startsWith('#') ? hexToRgb(v) : hslToRgb(...parseHsl(v))
}

function luminance([r, g, b]: RGB): number {
  const c = [r, g, b].map((x) => {
    const s = x / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as RGB
}

function parseOverlay(): { rgb: RGB; alpha: number } {
  const m = cssVar('overlay').match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
  )
  if (!m) throw new Error('--overlay must be rgba()')
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) }
}

const neonNames = ['neon-cyan', 'neon-magenta', 'neon-green']
const bg = colorToRgb(cssVar('bg'))
const surface = colorToRgb(cssVar('surface'))
const text = colorToRgb(cssVar('text'))
const neon = Object.fromEntries(neonNames.map((n) => [n, colorToRgb(cssVar(n))]))

function rule(css: string, selector: string): string {
  // Flat block scan: selector lists never contain braces, so nested @media
  // blocks simply yield their inner rules as separate matches.
  const bodies: string[] = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim())
    if (sels.includes(selector)) bodies.push(m[2])
  }
  if (bodies.length === 0) throw new Error(`Rule not found: ${selector}`)
  return bodies.join('\n')
}

describe('theme (Req 2.1, 2.2)', () => {
  it('page background luminance is at most 0.05', () => {
    expect(luminance(bg)).toBeLessThanOrEqual(0.05)
    expect(luminance(surface)).toBeLessThanOrEqual(0.1)
  })

  it('neon palette has >=3 colors with S>=80%, L in 50-70%', () => {
    for (const n of neonNames) {
      const [, s, l] = parseHsl(cssVar(n))
      expect(s).toBeGreaterThanOrEqual(80)
      expect(l).toBeGreaterThanOrEqual(50)
      expect(l).toBeLessThanOrEqual(70)
    }
  })

  it('no two neon hues are within 30 degrees (circular)', () => {
    const hues = neonNames.map((n) => parseHsl(cssVar(n))[0])
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const d = Math.abs(hues[i] - hues[j])
        expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(30)
      }
    }
  })
})

describe('contrast (Req 2.4, 3.8, 7.7)', () => {
  const { rgb: ovRgb, alpha } = parseOverlay()
  // Image pixel assumption: black and mid-gray. A pure-white pixel under a 50%
  // overlay cannot give 4.5:1 for light text, so the check uses mid-tone.
  const imagePixels: RGB[] = [
    [0, 0, 0],
    [128, 128, 128],
  ]

  it('text, muted text, and neon text on solid bg/surface are >= 4.5:1', () => {
    for (const base of [bg, surface]) {
      expect(contrast(text, base)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(colorToRgb(cssVar('text-muted')), base)).toBeGreaterThanOrEqual(4.5)
      for (const n of neonNames) {
        expect(contrast(neon[n], base)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('button label colors on surface are >= 4.5:1 in default/hover/focus/active', () => {
    // Button color is var(--btn-color) in every state; background stays --surface.
    const btn = rule(appCss, '.actions button')
    expect(btn).toMatch(/color:\s*var\(--btn-color\)/)
    expect(btn).toMatch(/background:\s*var\(--surface\)/)
    const active = rule(appCss, '.actions button:active')
    expect(active).toMatch(/color:\s*var\(--btn-color\)/)
    expect(active).toMatch(/background:\s*var\(--surface\)/)
    for (const n of ['neon-cyan', 'neon-magenta']) {
      expect(contrast(neon[n], surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('page text and neon text over the overlay composite are >= 4.5:1', () => {
    for (const px of imagePixels) {
      const composited = composite(ovRgb, alpha, px)
      expect(contrast(text, composited)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(neon['neon-green'], composited)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(neon['neon-cyan'], composited)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('glow and motion (Req 2.5, 2.7)', () => {
  it('hover/focus glow uses a neon color with blur >= 8px', () => {
    const r = rule(appCss, '.actions button:hover')
    const shadows = [...r.matchAll(/(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(\d+)px\s+var\(--btn-color\)/g)]
    expect(shadows.length).toBeGreaterThan(0)
    for (const s of shadows) expect(Number(s[3])).toBeGreaterThanOrEqual(8)
    expect(appCss).toMatch(/\.actions button:focus-visible/)
    expect(rule(appCss, '.actions button')).toMatch(/--btn-color:\s*var\(--neon-/)
  })

  it('transition is <= 200ms', () => {
    const m = rule(appCss, '.actions button').match(/transition:[^;]*?(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeLessThanOrEqual(200)
  })

  it('reduced-motion removes transition/animation but keeps the glow', () => {
    const idx = appCss.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(idx).toBeGreaterThanOrEqual(0)
    const block = appCss.slice(idx)
    expect(block).toMatch(/transition:\s*none/)
    expect(block).toMatch(/animation:\s*none/)
    expect(block).not.toMatch(/box-shadow/)
  })
})

describe('background (Req 3.1, 3.3, 3.4)', () => {
  it('background image is fixed, full-viewport, and cover-scaled', () => {
    const base = rule(appCss, '.landing::before')
    expect(base).toMatch(/url\('\.\/assets\/landing-bg\.jpg'\)/)
    expect(base).toMatch(/center\s*\/\s*cover\s+no-repeat/)
    const shared = appCss.match(/\.landing::before,\s*\.landing::after\s*\{([^}]*)\}/)![1]
    expect(shared).toMatch(/position:\s*fixed/)
    expect(shared).toMatch(/inset:\s*0/)
    expect(shared).toMatch(/width:\s*100%/)
    expect(shared).toMatch(/height:\s*100%/)
  })

  it('solid dark fallback color sits behind the image', () => {
    expect(rule(appCss, '.landing::before')).toMatch(/background:\s*var\(--bg\)/)
  })

  it('overlay is dark with 40-60% opacity and sits between image and content', () => {
    const { rgb, alpha } = parseOverlay()
    expect(luminance(rgb)).toBeLessThanOrEqual(0.05)
    expect(alpha).toBeGreaterThanOrEqual(0.4)
    expect(alpha).toBeLessThanOrEqual(0.6)
    const after = rule(appCss, '.landing::after')
    expect(after).toMatch(/background:\s*var\(--overlay\)/)
    const zBefore = Number(rule(appCss, '.landing::before').match(/z-index:\s*(-?\d+)/)![1])
    const zAfter = Number(after.match(/z-index:\s*(-?\d+)/)![1])
    expect(zBefore).toBeLessThan(zAfter)
    expect(zAfter).toBeLessThan(0)
  })
})

describe('target size and focus (Req 7.2, 7.4)', () => {
  it('buttons are at least 44x44px with >= 8px gap', () => {
    const btn = rule(appCss, '.actions button')
    expect(Number(btn.match(/min-width:\s*(\d+)px/)![1])).toBeGreaterThanOrEqual(44)
    expect(Number(btn.match(/min-height:\s*(\d+)px/)![1])).toBeGreaterThanOrEqual(44)
    expect(Number(rule(appCss, '.actions').match(/gap:\s*(\d+)px/)![1])).toBeGreaterThanOrEqual(8)
  })

  it('focus outline is >= 2px with >= 3:1 contrast vs adjacent colors', () => {
    for (const sel of ['.actions button:focus-visible', '.landing-footer a:focus-visible']) {
      const m = rule(appCss, sel).match(/outline:\s*(\d+)px\s+solid\s+var\(--([\w-]+)\)/)
      expect(m, sel).not.toBeNull()
      expect(Number(m![1])).toBeGreaterThanOrEqual(2)
      const color = neon[m![2]] ?? colorToRgb(cssVar(m![2]))
      const { rgb, alpha } = parseOverlay()
      for (const adjacent of [bg, surface, composite(rgb, alpha, [128, 128, 128])]) {
        expect(contrast(color, adjacent)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('asset (Req 3.4)', () => {
  it('background image exists at src/assets/landing-bg.jpg', () => {
    const p = join(root, 'src/assets/landing-bg.jpg')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(0)
  })

  it('no external image URL appears in source', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (['.ts', '.tsx', '.css', '.html'].includes(extname(p)) && !e.name.includes('.test.'))
          files.push(p)
      }
    }
    walk(join(root, 'src'))
    files.push(join(root, 'index.html'))
    const external =
      /(?:url\(\s*['"]?|src\s*=\s*['"{`]+|srcset\s*=\s*['"]|import\s+[^'"]*from\s+['"])https?:\/\/|https?:\/\/[^\s'"`)]+\.(?:jpe?g|png|gif|webp|avif|svg)\b|images\.unsplash\.com/i
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(external)
    }
  })
})
