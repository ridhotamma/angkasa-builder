/**
 * The editor's shell at a desktop width: the section list on the left never
 * goes away, and whatever is picked opens in the inspector on the right.
 *
 * Pins the layout contract rather than any one form: picking from the list
 * fills the inspector, closing it leaves nothing picked, the theme settings
 * open there too, a host panel (the AI chat) takes the inspector's place and
 * not the list's, and a picked section that is removed leaves nothing picked.
 */

import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import {
  createSection,
  DEFAULT_THEME_SETTINGS,
  sanitizeLayout,
  type SectionInstance,
} from '../src/index'
import { PageBuilder, type PageBuilderProps } from '../src/editor/index'
import { sampleStorefrontData } from '../src/render/index'

afterEach(() => cleanup())

// Wide enough for the three-column layout (`xl` and up).
;(
  window as unknown as {
    happyDOM?: { setViewport?: (size: { width: number; height: number }) => void }
  }
).happyDOM?.setViewport?.({ width: 1440, height: 900 })

// Built once: the builder compares its data by identity, as a screen's
// queries would hand it.
const DATA = sampleStorefrontData('Kopi Kita')
const LAYOUT = sanitizeLayout(null)
const SERVICES = {
  uploadImage: async () => '',
  imageUrl: () => null,
  collections: [],
  categories: [],
  pages: [],
}
const formatPrice = (amount: number) => `IDR ${amount}`

function Editor(props: Partial<PageBuilderProps>) {
  const [sections, setSections] = useState<SectionInstance[]>(() => [
    createSection('hero', { heading: 'Feel the difference' }),
    createSection('rich-text', { heading: 'Our story' }),
  ])
  const [settings, setSettings] = useState(DEFAULT_THEME_SETTINGS)
  const [layout, setLayout] = useState(LAYOUT)
  return (
    <PageBuilder
      height="900px"
      sections={sections}
      onSectionsChange={setSections}
      settings={settings}
      onSettingsChange={setSettings}
      layout={layout}
      onLayoutChange={setLayout}
      data={DATA}
      services={SERVICES}
      formatPrice={formatPrice}
      {...props}
    />
  )
}

function renderEditor(props: Partial<PageBuilderProps> = {}) {
  return render(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <Editor {...props} />
      </I18nProvider>
    </ChakraProvider>,
  )
}

/** The two side columns: the section list, then the inspector. */
function columns() {
  const [sidebar, inspector] = document.querySelectorAll('aside')
  return {
    sidebar: within(sidebar as HTMLElement),
    inspector: within(inspector as HTMLElement),
  }
}

function click(element: HTMLElement) {
  act(() => {
    fireEvent.click(element)
  })
}

describe('PageBuilder shell', () => {
  test('starts with nothing picked: the list on the left, a hint on the right', () => {
    renderEditor()
    const { sidebar, inspector } = columns()
    expect(sidebar.getByText('Hero banner')).toBeTruthy()
    expect(sidebar.getByRole('button', { name: /Theme settings/ })).toBeTruthy()
    expect(inspector.getByText('Nothing selected')).toBeTruthy()
  })

  test('a section picked in the list opens its properties beside the list', () => {
    renderEditor()
    click(columns().sidebar.getByRole('button', { name: /Hero banner/ }))

    const { sidebar, inspector } = columns()
    expect(inspector.getByRole('tab', { name: 'Content' })).toBeTruthy()
    expect(inspector.getByRole('tab', { name: 'Style' })).toBeTruthy()
    expect(inspector.getByDisplayValue('Feel the difference')).toBeTruthy()
    // The list is still there, every row of it.
    expect(sidebar.getByText('Text')).toBeTruthy()

    click(inspector.getByRole('button', { name: 'Close' }))
    expect(columns().inspector.getByText('Nothing selected')).toBeTruthy()
  })

  test('the theme settings open in the inspector', () => {
    renderEditor()
    click(columns().sidebar.getByRole('button', { name: /Theme settings/ }))
    expect(columns().inspector.getByText(/Colours, fonts and shape/)).toBeTruthy()
  })

  test('startWithLooks opens on the theme settings', () => {
    renderEditor({ startWithLooks: {} })
    expect(columns().inspector.getByText(/Colours, fonts and shape/)).toBeTruthy()
  })

  test('a host panel takes the inspector’s place, not the list’s', () => {
    renderEditor({ panelOverride: <p>AI chat</p> })
    const { sidebar, inspector } = columns()
    expect(inspector.getByText('AI chat')).toBeTruthy()
    expect(sidebar.getByText('Hero banner')).toBeTruthy()
  })

  test('removing the picked section leaves nothing picked', async () => {
    renderEditor()
    click(columns().sidebar.getByRole('button', { name: /Hero banner/ }))
    expect(columns().inspector.getByRole('tab', { name: 'Content' })).toBeTruthy()

    // The row's "⋯" menu is a zag machine: it opens on a real pointer
    // sequence, and selects the highlighted item from the keyboard. The menu
    // takes focus in a later frame, so it is focused here rather than waited
    // for — the last item, Remove, is then one ArrowUp away.
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 })
    const row = columns()
      .sidebar.getByText('Hero banner')
      .closest('[data-section-row]') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    const menu = within(document.body).getByRole('menu', { hidden: true })
    expect(within(menu).getByRole('menuitem', { name: /Remove/, hidden: true })).toBeTruthy()
    act(() => menu.focus())
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{Enter}')

    expect(columns().sidebar.queryByText('Hero banner')).toBeNull()
    expect(columns().sidebar.getByText('Text')).toBeTruthy()
    expect(columns().inspector.getByText('Nothing selected')).toBeTruthy()
  })
})
