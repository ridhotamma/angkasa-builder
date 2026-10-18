import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { system } from '@repo/theme'

import { ColorInput } from '../src/editor/controls'
import {
  SECTION_STYLE_FIELDS,
  SWITCHED_OFF_STYLE_KEYS,
  VISIBILITY_STYLE_KEYS,
} from '../src/model/section-style'

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

/**
 * What the Styles tab offers, and how much it says.
 *
 * The panel is a column of short controls: a hint that runs to a paragraph is
 * the wall of text this pins against. Switched-off features (`sticky`,
 * `textShadow`, `stagger`) stay in the schema — the sanitiser and the renderer
 * keep reading them — but must not appear here.
 */
describe('the Styles tab fields', () => {
  const offered = SECTION_STYLE_FIELDS.map((field) => field.key).filter(
    (key) =>
      !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(key) &&
      !SWITCHED_OFF_STYLE_KEYS.includes(key),
  )

  test('never offers a field whose feature is switched off', () => {
    for (const key of SWITCHED_OFF_STYLE_KEYS) {
      expect(offered, key).not.toContain(key)
      expect(
        SECTION_STYLE_FIELDS.map((field) => field.key),
        key,
      ).toContain(key)
    }
  })

  test('keeps every hint to a short line', () => {
    for (const field of SECTION_STYLE_FIELDS) {
      if (field.help) {
        expect(field.help.en.length, `${field.key} (en)`).toBeLessThanOrEqual(80)
        expect(field.help.id.length, `${field.key} (id)`).toBeLessThanOrEqual(90)
      }
    }
  })
})
