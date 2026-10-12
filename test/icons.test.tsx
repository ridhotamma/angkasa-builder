import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { system } from '@repo/theme'

import { FeatureIcon, iconGlyph } from '../src/render/icons'

function render(node: ReactNode): string {
  return renderToString(<ChakraProvider value={system}>{node}</ChakraProvider>)
}

describe('iconGlyph', () => {
  test('a catalogue name resolves to a glyph', () => {
    expect(iconGlyph('coffee')).toBeTruthy()
  })

  test('a legacy name resolves', () => {
    expect(iconGlyph('shield')).toBeTruthy()
  })

  test('an unknown name still draws something', () => {
    expect(iconGlyph('not-an-icon')).toBeTruthy()
  })

  test('"No icon" draws nothing', () => {
    expect(iconGlyph('')).toBeNull()
  })
})

describe('FeatureIcon', () => {
  test('a core icon draws synchronously', () => {
    const html = render(<FeatureIcon name="truck" boxSize="4" />)
    expect(html).toContain('<svg')
    expect(html).toContain('<path')
  })

  test('"No icon" renders no markup', () => {
    expect(render(<FeatureIcon name="" boxSize="4" />)).not.toContain('<svg')
  })

  // The storefront splits the set: a non-core glyph is a lazy chunk, so it
  // streams in (server) or pops in (client) rather than blocking the page.
  test('a non-core icon renders through Suspense without throwing', () => {
    expect(() => render(<FeatureIcon name="coffee" boxSize="4" />)).not.toThrow()
  })
})
