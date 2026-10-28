/**
 * The React editor on the shared core: the real `PageBuilder`, hosted the way
 * the dashboards host it (sections and undo in the screen), driven by clicks,
 * typing and the keyboard. Every one of these goes through an
 * `editor-core` command now, so this is where the two are held together.
 *
 * Isolated: run in its own `bun test` process (see the package's `test`
 * script). Once a mounted editor's sections change, happy-dom's shared
 * document no longer applies the styles later files read — the editor did
 * this before the core, too — so the file is kept out of the main run by its
 * name, which `bun test` does not pick up on its own.
 */

import '../happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { createSection, DEFAULT_THEME_SETTINGS, type SectionInstance } from '../../src/index'
import { PageBuilder, useUndoableState, type EditorServices } from '../../src/editor/index'
import { sampleStorefrontData } from '../../src/render/index'

afterEach(() => cleanup())

const services: EditorServices = {
  uploadImage: async () => 'file',
  imageUrl: () => null,
  collections: [],
  categories: [],
  pages: [],
}

const DATA = sampleStorefrontData('Builder shop')

/** The latest sections the host holds, for the assertions. */
let hosted: SectionInstance[] = []

function Host({ initial }: { initial: SectionInstance[] }) {
  const { value, set, history } = useUndoableState(initial)
  hosted = value
  const [settings] = useState(DEFAULT_THEME_SETTINGS)
  return (
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <PageBuilder
          sections={value}
          onSectionsChange={set}
          settings={settings}
          data={DATA}
          services={services}
          formatPrice={(amount, currency) => `${currency} ${amount}`}
          history={history}
          height="800px"
        />
      </I18nProvider>
    </ChakraProvider>
  )
}

function page() {
  return [
    createSection('rich-text', { heading: 'First heading', body: 'One' }),
    createSection('rich-text', { heading: 'Second heading', body: 'Two' }),
  ]
}

function rowButton(container: HTMLElement, id: string) {
  const row = container.querySelector<HTMLElement>(`[data-section-row="${id}"]`)
  return row?.querySelector<HTMLElement>('button')
}

function key(init: KeyboardEventInit) {
  fireEvent.keyDown(document.body, { bubbles: true, ...init })
}

describe('the editor on the core', () => {
  test('picks a section from the list and edits its settings', async () => {
    const sections = page()
    const { container } = render(<Host initial={sections} />)
    const first = sections[0]!

    await waitFor(() => expect(rowButton(container, first.id)).toBeTruthy())
    fireEvent.click(rowButton(container, first.id)!)

    // The section's form is on the panel, holding its heading.
    const input = await waitFor(() => {
      const found = container.querySelector<HTMLInputElement>('input[value="First heading"]')
      expect(found).toBeTruthy()
      return found!
    })
    const user = userEvent.setup()
    await user.clear(input)
    await user.type(input, 'Edited heading')
    await waitFor(() => expect(hosted[0]!.settings.heading).toBe('Edited heading'))
    // Only the picked section changed.
    expect(hosted[1]).toBe(sections[1]!)
  })

  test('the keyboard duplicates, moves and removes the selection, and undo takes it back', async () => {
    const sections = page()
    const { container } = render(<Host initial={sections} />)
    await waitFor(() => expect(rowButton(container, sections[0]!.id)).toBeTruthy())
    fireEvent.click(rowButton(container, sections[0]!.id)!)

    await waitFor(() =>
      expect(container.querySelector('input[value="First heading"]')).toBeTruthy(),
    )
    act(() => key({ key: 'd', ctrlKey: true }))
    await waitFor(() => expect(hosted).toHaveLength(3))
    const copy = hosted[1]!
    expect(copy.id).not.toBe(sections[0]!.id)
    expect(copy.settings.heading).toBe('First heading')

    // The copy is now the selection: Alt+↓ moves it, Delete removes it.
    act(() => key({ key: 'ArrowDown', altKey: true }))
    await waitFor(() => expect(hosted[2]!.id).toBe(copy.id))
    // Edits closer together than one burst of typing are one undo step, so
    // the removal waits to be a step of its own.
    await new Promise((resolve) => setTimeout(resolve, 650))
    act(() => key({ key: 'Delete' }))
    await waitFor(() =>
      expect(hosted.map((section) => section.id)).toEqual(sections.map((section) => section.id)),
    )

    act(() => key({ key: 'z', ctrlKey: true }))
    await waitFor(() => expect(hosted).toHaveLength(3))
    expect(hosted[2]!.id).toBe(copy.id)
  })
})
