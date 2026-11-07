import { describe, it, expect } from 'vitest'
import type { RouteObject } from 'react-router'
import { appRoutes, createAppRouter } from './routes'

function flatten(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((r) => [r, ...flatten(r.children ?? [])])
}

const all = flatten(appRoutes)
const pathed = all.filter((r) => r.path !== undefined)

describe('appRoutes', () => {
  it('defines "/" and "/home"', () => {
    const paths = pathed.map((r) => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/home')
  })

  it('defines a catch-all route', () => {
    expect(pathed.map((r) => r.path)).toContain('*')
  })

  it('has no path naming a modal mode', () => {
    const modes = ['login', 'register', 'signup', 'forgot', 'reset', 'password', 'auth']
    for (const r of pathed) {
      for (const m of modes) expect(r.path!.toLowerCase()).not.toContain(m)
    }
  })

  it('gives every pathed route a handle with access and title', () => {
    for (const r of pathed) {
      const h = r.handle as { access?: string; title?: string } | undefined
      expect(h, `handle for ${r.path}`).toBeDefined()
      expect(['public', 'protected']).toContain(h!.access)
      expect(h!.title).toBeTruthy()
    }
  })
})

describe('createAppRouter', () => {
  it('passes BASE_URL as the router basename', () => {
    const router = createAppRouter()
    expect(router.basename).toBe(import.meta.env.BASE_URL)
    router.dispose()
  })
})
