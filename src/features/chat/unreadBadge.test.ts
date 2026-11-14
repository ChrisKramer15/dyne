import { describe, expect, it } from 'vitest'
import { badgeText, chatNavLabel, conversationLabel } from './unreadBadge'

describe('badgeText', () => {
  it.each([
    [0, ''],
    [1, '1'],
    [99, '99'],
    [100, '99+'],
    [142, '99+'],
  ])('%i -> %j', (n, expected) => {
    expect(badgeText(n)).toBe(expected)
  })
})

describe('chatNavLabel', () => {
  it('has no count when zero', () => expect(chatNavLabel(0)).toBe('Chat'))
  it('uses singular for 1', () => expect(chatNavLabel(1)).toBe('Chat, 1 unread message'))
  it('uses plural', () => expect(chatNavLabel(5)).toBe('Chat, 5 unread messages'))
  it('is uncapped above 99', () => expect(chatNavLabel(142)).toBe('Chat, 142 unread messages'))
})

describe('conversationLabel', () => {
  it('states zero as no unread messages', () =>
    expect(conversationLabel('Alice', 0)).toBe('Alice, no unread messages'))
  it('uses singular for 1', () =>
    expect(conversationLabel('Alice', 1)).toBe('Alice, 1 unread message'))
  it('is uncapped above 99', () =>
    expect(conversationLabel('Alice', 142)).toBe('Alice, 142 unread messages'))
  it('omits the count when unknown', () => expect(conversationLabel('Alice', null)).toBe('Alice'))
})
