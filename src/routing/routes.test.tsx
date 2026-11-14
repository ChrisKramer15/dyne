import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'
import type { RouteObject } from 'react-router'
// testUtils must be imported before routes (it installs the Supabase mock).
import { renderApp } from './testUtils'
import { appRoutes, createAppRouter } from './routes'

afterEach(cleanup)

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

describe('chat routes', () => {
  const CONVERSATION_PATH = '/chat/123e4567-e89b-42d3-a456-426614174000'

  it.each(['/chat', '/chat/:conversationId'])('marks %s as protected', (path) => {
    const route = pathed.find((r) => r.path === path)
    expect(route, `route ${path}`).toBeDefined()
    expect((route!.handle as { access?: string }).access).toBe('protected')
  })

  it.each(['/chat', CONVERSATION_PATH])(
    'redirects an unauthenticated visit to %s, keeps the return path, and renders no chat content',
    async (path) => {
      const app = renderApp({ status: 'unauthenticated', path })
      await waitFor(() => expect(app.location().pathname).toBe('/'))
      expect(app.location().state).toEqual({ from: path })
      expect(app.queryByRole('heading', { name: 'Chat' })).toBeNull()
      expect(app.container.querySelector('.conversation-view')).toBeNull()
    },
  )
})

describe('createAppRouter', () => {
  it('passes BASE_URL as the router basename', () => {
    const router = createAppRouter()
    expect(router.basename).toBe(import.meta.env.BASE_URL)
    router.dispose()
  })
})
