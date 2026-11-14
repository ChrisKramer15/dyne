import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../auth/authContext'
import type { AuthState } from '../../auth/authReducer'
import { ChatProvider } from './ChatProvider'
import { NewConversationPanel } from './NewConversationPanel'
import type {
  CreateGroupResult,
  OpenPersonalResult,
  SearchUsersResult,
  UserSummary,
} from './chatService'

const authed: AuthState = { status: 'authenticated', userMetadata: {}, userId: 'me' }

const ME: UserSummary = { userId: 'me', username: 'Myself' }
const ANN: UserSummary = { userId: 'u1', username: 'Ann' }
const BOB: UserSummary = { userId: 'u2', username: 'Bob' }
const CAL: UserSummary = { userId: 'u3', username: 'Cal' }

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

interface Opts {
  users?: UserSummary[]
  open?: () => Promise<OpenPersonalResult>
  create?: () => Promise<CreateGroupResult>
}

function setup(opts: Opts = {}) {
  const searchUsers = vi.fn(
    async (): Promise<SearchUsersResult> => ({ ok: true, users: opts.users ?? [ANN, BOB, CAL] }),
  )
  const openPersonalConversation = vi.fn(
    opts.open ?? (async (): Promise<OpenPersonalResult> => ({ ok: true, conversationId: 'p1' })),
  )
  const createGroup = vi.fn(
    opts.create ?? (async (): Promise<CreateGroupResult> => ({ ok: true, conversationId: 'g1' })),
  )
  const service = {
    searchUsers,
    openPersonalConversation,
    createGroup,
    loadUnreadTotal: async () => ({ ok: true, entries: [] }),
    subscribe: () => () => {},
  } as never
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <AuthContext.Provider value={authed}>
        <ChatProvider service={service}>
          <Routes>
            <Route path="/chat" element={<NewConversationPanel onClose={onClose} />} />
            <Route path="/chat/:id" element={<Where />} />
          </Routes>
          <Where />
        </ChatProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return { searchUsers, openPersonalConversation, createGroup, onClose }
}

async function search(text: string) {
  await userEvent.type(screen.getByLabelText('Find a user'), text)
}

describe('NewConversationPanel user search', () => {
  it('shows "No users found." for an empty result (3.6)', async () => {
    setup({ users: [] })
    await search('zzz')
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  it('lists matches returned by the service (3.5)', async () => {
    const { searchUsers } = setup()
    await search('a')
    expect(await screen.findByText('Ann')).toBeInTheDocument()
    expect(searchUsers).toHaveBeenCalledWith('a')
  })
})

describe('NewConversationPanel personal conversation', () => {
  it('opens a new or existing conversation and navigates to it (3.1-3.3)', async () => {
    const { openPersonalConversation, onClose } = setup()
    await search('a')
    await userEvent.click(await screen.findByRole('button', { name: 'Message Ann' }))
    expect(openPersonalConversation).toHaveBeenCalledWith('u1')
    expect(openPersonalConversation).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
    expect((await screen.findAllByTestId('where')).some((e) => e.textContent === '/chat/p1')).toBe(
      true,
    )
  })

  it('rejects selecting oneself without calling the service or leaving the view (3.4)', async () => {
    const { openPersonalConversation, onClose } = setup({ users: [ME] })
    await search('my')
    await userEvent.click(await screen.findByRole('button', { name: 'Message Myself' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot start a conversation with yourself.',
    )
    expect(openPersonalConversation).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('where')[0]).toHaveTextContent('/chat')
    expect(screen.queryByText('/chat/p1')).not.toBeInTheDocument()
  })

  it('shows the self error when the service reports self (3.4)', async () => {
    setup({ open: async () => ({ ok: false, error: 'self' }) })
    await search('a')
    await userEvent.click(await screen.findByRole('button', { name: 'Message Ann' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('yourself')
  })

  it('stays on the view with an error when opening fails (3.7)', async () => {
    const { onClose } = setup({ open: async () => ({ ok: false, error: 'unavailable' }) })
    await search('a')
    await userEvent.click(await screen.findByRole('button', { name: 'Message Ann' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The conversation could not be opened.')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('NewConversationPanel group form validation', () => {
  async function addMembers(...names: string[]) {
    await userEvent.click(screen.getByRole('button', { name: 'Group chat' }))
    await search('a')
    for (const n of names) {
      await userEvent.click(await screen.findByRole('button', { name: `Add ${n} to group` }))
    }
  }

  it('requires a group name (4.3)', async () => {
    const { createGroup } = setup()
    await addMembers('Ann', 'Bob')
    await userEvent.type(screen.getByLabelText('Group name'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A group name is required.')
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('rejects a name over 60 characters with the limit in the message (4.4)', async () => {
    const { createGroup } = setup()
    await addMembers('Ann', 'Bob')
    await userEvent.click(screen.getByLabelText('Group name'))
    await userEvent.paste('x'.repeat(61))
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 60 characters')
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('requires at least two other users (4.5)', async () => {
    const { createGroup } = setup()
    await addMembers('Ann')
    await userEvent.type(screen.getByLabelText('Group name'), 'Team')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least 2 other users.')
    expect(createGroup).not.toHaveBeenCalled()
  })

  it('rejects more than Max_Group_Size participants (4.6)', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ userId: `m${i}`, username: `Member${i}` }))
    const { createGroup } = setup({ users: many })
    await userEvent.click(screen.getByRole('button', { name: 'Group chat' }))
    await search('m')
    for (const u of many) {
      await userEvent.click(await screen.findByRole('button', { name: `Add ${u.username} to group` }))
    }
    await userEvent.type(screen.getByLabelText('Group name'), 'Big')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 50 participants')
    expect(createGroup).not.toHaveBeenCalled()
  }, 30_000)

  it('creates a valid group and navigates to it (4.1)', async () => {
    const { createGroup } = setup()
    await addMembers('Ann', 'Bob')
    await userEvent.type(screen.getByLabelText('Group name'), 'Team')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(createGroup).toHaveBeenCalledWith({ name: 'Team', memberIds: ['u1', 'u2'] })
    expect((await screen.findAllByTestId('where')).some((e) => e.textContent === '/chat/g1')).toBe(
      true,
    )
  })

  it('shows an error when creation fails (4.10)', async () => {
    const { onClose } = setup({ create: async () => ({ ok: false, error: 'unavailable' }) })
    await addMembers('Ann', 'Bob')
    await userEvent.type(screen.getByLabelText('Group name'), 'Team')
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The group could not be created.')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('NewConversationPanel mode toggle', () => {
  const direct = () => screen.getByRole('button', { name: 'Direct message' })
  const group = () => screen.getByRole('button', { name: 'Group chat' })

  it('defaults to Direct mode with only search and Message actions', async () => {
    setup()
    expect(direct()).toHaveAttribute('aria-pressed', 'true')
    expect(group()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create group' })).not.toBeInTheDocument()
    await search('a')
    expect(await screen.findByRole('button', { name: 'Message Ann' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Ann to group' })).not.toBeInTheDocument()
  })

  it('Group mode shows group fields and Add to group instead of Message', async () => {
    setup()
    await userEvent.click(group())
    expect(group()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Group name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create group' })).toBeInTheDocument()
    await search('a')
    expect(await screen.findByRole('button', { name: 'Add Ann to group' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Message Ann' })).not.toBeInTheDocument()
  })

  it('keeps search text across modes and keeps group name and members when toggling back', async () => {
    setup()
    await userEvent.click(group())
    await search('a')
    await userEvent.type(screen.getByLabelText('Group name'), 'Team')
    await userEvent.click(await screen.findByRole('button', { name: 'Add Ann to group' }))
    await userEvent.click(direct())
    expect(screen.getByLabelText('Find a user')).toHaveValue('a')
    expect(await screen.findByRole('button', { name: 'Message Ann' })).toBeInTheDocument()
    await userEvent.click(group())
    expect(screen.getByLabelText('Find a user')).toHaveValue('a')
    expect(screen.getByLabelText('Group name')).toHaveValue('Team')
    expect(screen.getByRole('button', { name: 'Remove Ann' })).toBeInTheDocument()
  })

  it('is keyboard operable', async () => {
    setup()
    group().focus()
    await userEvent.keyboard('{Enter}')
    expect(group()).toHaveAttribute('aria-pressed', 'true')
    direct().focus()
    await userEvent.keyboard(' ')
    expect(direct()).toHaveAttribute('aria-pressed', 'true')
  })
})
