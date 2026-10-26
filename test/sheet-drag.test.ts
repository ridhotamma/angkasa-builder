/** Where the phone sheet settles when a drag lets go. */

import { describe, expect, test } from 'bun:test'

import { settleSheet } from '../src/editor/sheet-drag'

const viewport = 800

describe('settleSheet', () => {
  test('a slow release lands on the nearest stop', () => {
    expect(settleSheet({ height: 700, viewport, velocity: 0, from: 'half' })).toBe('full')
    expect(settleSheet({ height: 520, viewport, velocity: 0, from: 'full' })).toBe('half')
    expect(settleSheet({ height: 420, viewport, velocity: 0, from: 'half' })).toBe('half')
  })

  test('pulled low enough, it closes', () => {
    expect(settleSheet({ height: 200, viewport, velocity: 0, from: 'half' })).toBe('closed')
  })

  test('a flick up opens it fully, wherever it was let go', () => {
    expect(settleSheet({ height: 480, viewport, velocity: -1.2, from: 'half' })).toBe('full')
  })

  test('a flick down steps one stop down', () => {
    expect(settleSheet({ height: 700, viewport, velocity: 1.2, from: 'full' })).toBe('half')
    expect(settleSheet({ height: 470, viewport, velocity: 1.2, from: 'half' })).toBe('closed')
  })
})
