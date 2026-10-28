/**
 * The add palette is a step deeper into the section list, and both directions
 * slide. This is the wiring test for `PanelSlide`: the list's own screen is
 * what leaves, and the palette's back button brings the list back from the
 * other side.
 */

import './happy-dom-setup'

import { afterEach, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { SectionList } from '../src/editor/section-list'

afterEach(() => cleanup())

function list() {
  return render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <SectionList
          sections={[]}
          onChange={() => undefined}
          selectedId={null}
          onSelect={() => undefined}
        />
      </LocaleProvider>
    </ChakraProvider>,
  )
}

function outgoing(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>('[data-panel-outgoing]')
  if (!layer) throw new Error('no outgoing layer')
  return layer
}

test('the add palette slides in from the right, and the list back from the left', async () => {
  const user = userEvent.setup()
  const built = list()

  await user.click(built.getByRole('button', { name: 'Add section' }))

  // The list is on its way out, the palette is arriving.
  expect(outgoing(built.container).textContent).toContain('No sections yet')
  expect(built.getByPlaceholderText('Search sections…')).toBeDefined()
  expect(outgoing(built.container).textContent).not.toContain('Search sections…')

  // The palette's own back button (the only "Add section" left in the
  // accessibility tree — the outgoing list is hidden).
  await user.click(built.getByRole('button', { name: 'Add section' }))

  expect(outgoing(built.container).textContent).toContain('Presets')
  expect(built.getByRole('button', { name: 'Add section' })).toBeDefined()
})
