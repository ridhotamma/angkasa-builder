import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { system } from '@repo/theme'

import { ColorInput } from '../src/editor/controls'

function render(node: ReactNode): string {
  return renderToString(<ChakraProvider value={system}>{node}</ChakraProvider>)
}

/**
 * Regression: a colour field with an empty default — "nothing overridden yet"
 * — must render rather than hand `parseColor` an empty string and throw.
 */
describe('ColorInput', () => {
  test('an empty value renders an empty picker', () => {
    expect(() => render(<ColorInput value="" onChange={() => undefined} />)).not.toThrow()
  })

  test('a stored hex renders through', () => {
    const html = render(<ColorInput value="#ff0000" onChange={() => undefined} />)
    expect(html).toContain('color-picker')
    expect(html.toLowerCase()).toContain('ff0000')
  })

  test('an unparseable value degrades to empty instead of throwing', () => {
    expect(() =>
      render(<ColorInput value="not-a-colour" onChange={() => undefined} />),
    ).not.toThrow()
  })
})
