import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render } from '@testing-library/react'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { DEFAULT_THEME_SETTINGS } from '../src'
import { ThemeSettingsPanel } from '../src/editor/theme-settings'

afterEach(() => cleanup())

describe('theme settings panel', () => {
  test('renders the photo flip switch and its help without a Field wrapper', () => {
    const view = render(
      <ChakraProvider value={system}>
        <LocaleProvider locale="en">
          <ThemeSettingsPanel settings={DEFAULT_THEME_SETTINGS} onChange={() => undefined} />
        </LocaleProvider>
      </ChakraProvider>,
    )

    // The help is deliberately a `Text` with the field helper's type style:
    // `Field.HelperText` would throw here because the switch is not inside a
    // `Field.Root`.
    expect(view.getByText('Second photo on hover')).toBeTruthy()
    expect(
      view.getByText(/Show the second gallery photo when a shopper points at a product card/),
    ).toBeTruthy()
  })
})
