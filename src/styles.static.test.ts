import { readFileSync, readdirSync } from 'node:fs'
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
  it('text, muted text, and neon text on solid bg/surface are >= 4.5:1', () => {
    for (const base of [bg, surface]) {
      expect(contrast(text, base)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(colorToRgb(cssVar('text-muted')), base)).toBeGreaterThanOrEqual(4.5)
      for (const n of neonNames) {
        expect(contrast(neon[n], base)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it.each(['.btn-primary', '.btn-login'])(
    '%s label (dark --bg) is >= 4.5:1 on every stop of its neon gradient',
    (sel) => {
      const btn = rule(appCss, sel)
      expect(btn).toMatch(/(?<!-)color:\s*var\(--bg\)/)
      const stops = [...btn.matchAll(/var\(--(neon-[\w-]+)\)/g)].map((m) => m[1])
      expect(stops.length).toBeGreaterThanOrEqual(2)
      for (const n of stops) {
        // Every gradient stop must be a neon colour (S >= 80%, L 50-70%)
        const [, s, l] = parseHsl(cssVar(n))
        expect(s, n).toBeGreaterThanOrEqual(80)
        expect(l, n).toBeGreaterThanOrEqual(50)
        expect(l, n).toBeLessThanOrEqual(70)
        expect(contrast(bg, colorToRgb(cssVar(n))), n).toBeGreaterThanOrEqual(4.5)
      }
      // Hover/focus only add glow and lift; they never change label or fill colour
      expect(rule(appCss, `${sel}:hover`)).not.toMatch(/(?<!-)color:|background/)
    },
  )

  it('every base accent is a neon colour with >= 4.5:1 on the page background', () => {
    // Accents colour the active base label and the description line
    for (const name of ['cyan', 'green', 'magenta', 'purple']) {
      const value = rule(appCss, `.accent-${name}`).match(/--accent:\s*([^;]+);/)![1].trim()
      const ref = value.match(/^var\(--(neon-[\w-]+)\)$/)
      const rgb = ref ? neon[ref[1]] : hslToRgb(...parseHsl(value))
      if (!ref) {
        const [, s, l] = parseHsl(value)
        expect(s, name).toBeGreaterThanOrEqual(80)
        expect(l, name).toBeGreaterThanOrEqual(50)
        expect(l, name).toBeLessThanOrEqual(75)
      }
      expect(contrast(rgb, bg), name).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('glow and motion (Req 2.5, 2.7)', () => {
  it.each(['.btn-primary', '.btn-login'])(
    '%s hover/focus glow is a neon colour with blur >= 8px',
    (sel) => {
      const r = rule(appCss, `${sel}:focus-visible`)
      const shadows = [
        ...r.matchAll(/(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(\d+)px\s+hsl\(\s*([\d.]+)\s+(\d+)%/g),
      ]
      expect(shadows.length).toBeGreaterThan(0)
      for (const s of shadows) {
        expect(Number(s[3])).toBeGreaterThanOrEqual(8)
        expect(Number(s[5]), 'saturation').toBeGreaterThanOrEqual(80)
      }
    },
  )

  it('interactive transitions are <= 200ms', () => {
    for (const sel of ['.btn', '.base-marker', '.base-label']) {
      const durations = [...rule(appCss, sel).matchAll(/transition:([^;]*);/g)].flatMap((m) =>
        [...m[1].matchAll(/(\d+)ms/g)].map((d) => Number(d[1])),
      )
      expect(durations.length, sel).toBeGreaterThan(0)
      for (const ms of durations) expect(ms, sel).toBeLessThanOrEqual(200)
    }
  })

  it('reduced-motion removes transition/animation but keeps the glow', () => {
    const idx = appCss.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(idx).toBeGreaterThanOrEqual(0)
    // Slice just this @media block (brace matching) so later sections are not included.
    let depth = 0
    let end = idx
    for (let i = appCss.indexOf('{', idx); i < appCss.length; i++) {
      if (appCss[i] === '{') depth++
      else if (appCss[i] === '}' && --depth === 0) {
        end = i + 1
        break
      }
    }
    const block = appCss.slice(idx, end)
    expect(block).toMatch(/transition:\s*none/)
    expect(block).toMatch(/animation:\s*none/)
    expect(block).not.toMatch(/box-shadow/)
  })
})

describe('background', () => {
  it('backdrop is a fixed full-viewport layer behind content, on solid --bg, with no image', () => {
    const base = rule(appCss, '.landing::before')
    expect(base).toMatch(/position:\s*fixed/)
    expect(base).toMatch(/inset:\s*0/)
    expect(Number(base.match(/z-index:\s*(-?\d+)/)![1])).toBeLessThan(0)
    expect(base).toMatch(/var\(--bg\);/)
    expect(appCss).not.toMatch(/url\(/)
  })
})

// Px floor of a declaration: the first px value, i.e. clamp()'s minimum or a
// plain px value. For min(Apx, <viewport expr>) this reads A; the viewport
// side is checked by the layout measurement (e.g. .btn's
// (100vw - 56px) / 2 is still 132px on a 320px-wide phone).
function floorPx(body: string, prop: string): number {
  const m = body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`))
  if (!m) throw new Error(`Missing ${prop}`)
  const px = m[1].match(/(\d+(?:\.\d+)?)px/)
  if (!px) throw new Error(`${prop} has no px floor: ${m[1]}`)
  return Number(px[1])
}

describe('target size and focus (Req 7.2, 7.4)', () => {
  it('every tap target is at least 44x44px', () => {
    for (const sel of ['.btn', '.base-btn']) {
      const body = rule(appCss, sel)
      expect(floorPx(body, 'min-width'), sel).toBeGreaterThanOrEqual(44)
      expect(floorPx(body, 'min-height'), sel).toBeGreaterThanOrEqual(44)
    }
  })

  it('Register and Login are separated by >= 8px', () => {
    expect(floorPx(rule(appCss, '.actions'), 'gap')).toBeGreaterThanOrEqual(8)
  })

  it('base focus ring is >= 2px in the base accent colour', () => {
    const m = rule(appCss, '.base-btn:focus-visible .base-label').match(
      /outline:\s*(\d+)px\s+solid\s+var\(--accent\)/,
    )
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(2)
  })

  it('focus outline is >= 2px with >= 3:1 contrast vs adjacent colors', () => {
    for (const sel of ['.btn:focus-visible']) {
      const m = rule(appCss, sel).match(/outline:\s*(\d+)px\s+solid\s+var\(--([\w-]+)\)/)
      expect(m, sel).not.toBeNull()
      expect(Number(m![1])).toBeGreaterThanOrEqual(2)
      const color = neon[m![2]] ?? colorToRgb(cssVar(m![2]))
      for (const adjacent of [bg, surface]) {
        expect(contrast(color, adjacent)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('homepage styles (Req 8.1, 8.2, 8.6)', () => {
  const declarations = (css: string) =>
    [...css.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)].map((m) => m[1])

  it('design tokens are defined once in index.css and never redefined in App.css', () => {
    const tokens = declarations(indexCss)
    expect(tokens.length).toBeGreaterThan(0)
    expect(new Set(tokens).size).toBe(tokens.length)
    for (const t of declarations(appCss)) expect(tokens, t).not.toContain(t)
  })

  it('no rule declares the same custom property twice', () => {
    for (const m of appCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const names = declarations(m[2])
      expect(new Set(names).size, m[1].trim()).toBe(names.length)
    }
  })

  it('backdrop layers are defined once and the hero image is referenced only by Backdrop', () => {
    for (const cls of ['.landing-photo', '.landing-scrim']) {
      const count = [...appCss.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].filter((m) =>
        m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim()).includes(cls),
      ).length
      expect(count, cls).toBe(1)
    }
    const referrers: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name !== 'assets') walk(p)
        } else if (
          ['.ts', '.tsx', '.css'].includes(extname(p)) &&
          !e.name.includes('.test.') &&
          /landing-hero/.test(readFileSync(p, 'utf8'))
        )
          referrers.push(e.name)
      }
    }
    walk(join(root, 'src'))
    expect(referrers).toEqual(['Backdrop.tsx'])
  })

  it('every visible focus outline is at least 2px', () => {
    const outlines = [...appCss.matchAll(/outline:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(outlines.length).toBeGreaterThan(0)
    for (const o of outlines) {
      if (o === 'none') continue
      const px = o.match(/^(\d+(?:\.\d+)?)px\s+solid\b/)
      expect(px, o).not.toBeNull()
      expect(Number(px![1]), o).toBeGreaterThanOrEqual(2)
    }
  })

  it('welcome and wordmark text colours meet 4.5:1 on bg', () => {
    for (const sel of ['.welcome', '.wordmark']) {
      const m = rule(appCss, sel).match(/(?<!-)color:\s*var\(--([\w-]+)\)/)
      if (!m) continue // inherits --text
      expect(contrast(colorToRgb(cssVar(m[1])), bg), sel).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('asset', () => {
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
