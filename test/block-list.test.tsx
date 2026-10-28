/**
 * How the editor lists the blocks inside a section.
 *
 * A row is a way into the block, not an accordion: clicking it asks the panel
 * to show that block's settings, and every row carries its own drag handle for
 * reordering. These tests click for real, scoped to happy-dom (see
 * `./happy-dom-setup`).
 */

import './happy-dom-setup'

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LocaleProvider } from '../src/locale'
import { system } from '../src/ui'

import { blockSchema, type BlocksField } from '../src/index'
import {
  BlockEditorProvider,
  BlockMoveMenu,
  BlockNamePopover,
  FieldsForm,
} from '../src/editor/controls'
import type { EditorServices } from '../src/editor/services'

afterEach(() => cleanup())

const field: BlocksField = {
  kind: 'blocks',
  key: 'blocks',
  label: { en: 'Blocks', id: 'Blok' },
  max: 30,
  blocks: [blockSchema('heading')!, blockSchema('column')!],
}

const values = {
  blocks: [
    { id: 'heading-1', type: 'heading', settings: { text: 'Hello' } },
    { id: 'column-1', type: 'column', settings: { blocks: [] } },
  ],
}

const services: EditorServices = {
  uploadImage: async () => '',
  imageUrl: () => null,
  collections: [],
  categories: [],
  pages: [],
}

function view(onSelect: (blockId: string) => void, custom = true) {
  return render(
    <ChakraProvider value={system}>
      <LocaleProvider locale="en">
        <BlockEditorProvider
          fields={[field]}
          values={values}
          onChange={() => undefined}
          editable
          custom={custom}
          selectedId={null}
          onSelect={onSelect}
        >
          <FieldsForm
            fields={[field]}
            values={values}
            onChange={() => undefined}
            services={services}
          />
        </BlockEditorProvider>
      </LocaleProvider>
    </ChakraProvider>,
  )
}

describe('the block list in a section', () => {
  test('opens a custom block instead of expanding its fields in place', () => {
    const onSelect = mock((_blockId: string) => undefined)
    const { getByRole, queryByText } = view(onSelect)

    fireEvent.click(getByRole('button', { name: 'Heading' }))

    expect(onSelect).toHaveBeenCalledWith('heading-1')
    expect(queryByText('Text')).toBeNull()
  })

  test('gives every custom block row a drag handle', () => {
    const { getAllByRole } = view(() => undefined)

    expect(getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(2)
  })

  test('keeps a preset block as an inline accordion', async () => {
    const onSelect = mock((_blockId: string) => undefined)
    const user = userEvent.setup()
    const { queryAllByRole, getByRole, getByDisplayValue, queryByLabelText } = view(onSelect, false)

    expect(queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)

    await user.click(getByRole('button', { name: 'Heading' }))

    expect(getByDisplayValue('Hello')).toBeTruthy()
    expect(queryByLabelText('Block name')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('the block name popover', () => {
  test('renames a block from the pencil beside its title', async () => {
    const onChange = mock((_name: string) => undefined)
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = render(
      <ChakraProvider value={system}>
        <LocaleProvider locale="en">
          <BlockNamePopover value="" fallback="Photo card" onChange={onChange} />
        </LocaleProvider>
      </ChakraProvider>,
    )

    await user.click(getByRole('button', { name: 'Rename block' }))
    const input = getByLabelText('Block name')
    await user.type(input, 'Highlighted cards')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('Highlighted cards')
  })

  test('a section reuses the popover with its own labels', async () => {
    const onChange = mock((_name: string) => undefined)
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = render(
      <ChakraProvider value={system}>
        <LocaleProvider locale="en">
          <BlockNamePopover
            value=""
            fallback="Blocks"
            renameMessage="renameSection"
            nameMessage="sectionName"
            onChange={onChange}
          />
        </LocaleProvider>
      </ChakraProvider>,
    )

    await user.click(getByRole('button', { name: 'Rename section' }))
    const input = getByLabelText('Section name')
    await user.type(input, 'Promo')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('Promo')
  })
})

describe('the move-to menu', () => {
  function menu(blockId: string, blocks: typeof values.blocks, compact = false) {
    return render(
      <ChakraProvider value={system}>
        <LocaleProvider locale="en">
          <BlockMoveMenu
            fields={[field]}
            values={{ blocks }}
            blockId={blockId}
            onChange={() => undefined}
            compact={compact}
          />
        </LocaleProvider>
      </ChakraProvider>,
    )
  }

  test('the panel trigger is an icon button, like the actions beside it', () => {
    // The heading can move into the column's own blocks, so the menu is live.
    const { getByRole, queryByText } = menu('heading-1', values.blocks)

    const trigger = getByRole('button', { name: 'Move to' })
    expect((trigger as HTMLButtonElement).disabled).toBe(false)
    // Icon-only: the label lives in the accessible name, not in visible text.
    expect(queryByText('Move to')).toBeNull()
  })

  test('the row trigger stays, disabled, when the block has nowhere else to go', () => {
    // A lone heading sits in the only container, so nothing is a valid target.
    const { getByRole } = menu(
      'h',
      [{ id: 'h', type: 'heading', settings: { text: 'Hello' } }],
      true,
    )

    expect((getByRole('button', { name: 'Move to' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
