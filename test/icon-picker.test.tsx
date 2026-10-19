import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { sanitizeValues, type IconField } from '../src/index'
import { IconPicker } from '../src/editor/icon-picker'
import { ICON_NAMES } from '../src/model/icons'

const field: IconField = {
  kind: 'icon',
  key: 'icon',
  label: { en: 'Icon', id: 'Ikon' },
  default: 'sparkles',
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('the icon catalogue', () => {
  test('every name is unique', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
  })
})

describe('icon field sanitising', () => {
  test('a catalogue name is kept', () => {
    expect(sanitizeValues([field], { icon: 'shield-check' }).icon).toBe('shield-check')
  })

  test('an empty value means "no icon", not the default', () => {
    expect(sanitizeValues([field], { icon: '' }).icon).toBe('')
  })

  test('an unknown name falls back to the default', () => {
    expect(sanitizeValues([field], { icon: 'not-an-icon' }).icon).toBe('sparkles')
  })
})

describe('IconPicker', () => {
  test('shows the current selection and the no-icon choice', () => {
    const html = render(<IconPicker value="shield-check" onChange={() => undefined} />)
    expect(html).toContain('shield-check')
    expect(html).toContain('No icon')
  })

  test('an empty value renders without throwing', () => {
    expect(() => render(<IconPicker value="" onChange={() => undefined} />)).not.toThrow()
  })
})
