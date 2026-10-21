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

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { blockSchema, type BlocksField } from '../src/index'
import { BlockEditorProvider, BlockNamePopover, FieldsForm } from '../src/editor/controls'
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

function view(onSelect: (blockId: string) => void) {
  return render(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        <BlockEditorProvider
          fields={[field]}
          values={values}
          onChange={() => undefined}
          editable
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
      </I18nProvider>
    </ChakraProvider>,
  )
}

describe('the block list in a section', () => {
  test('opens a block instead of expanding its fields in place', () => {
    const onSelect = mock((_blockId: string) => undefined)
    const { getByRole, queryByText } = view(onSelect)

    fireEvent.click(getByRole('button', { name: 'Heading' }))

    expect(onSelect).toHaveBeenCalledWith('heading-1')
    expect(queryByText('Text')).toBeNull()
  })

  test('gives every row a drag handle', () => {
    const { getAllByRole } = view(() => undefined)

    expect(getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(2)
  })
})

describe('the block name popover', () => {
  test('renames a block from the pencil beside its title', async () => {
    const onChange = mock((_name: string) => undefined)
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = render(
      <ChakraProvider value={system}>
        <I18nProvider locale="en" resources={{}}>
          <BlockNamePopover value="" fallback="Photo card" onChange={onChange} />
        </I18nProvider>
      </ChakraProvider>,
    )

    await user.click(getByRole('button', { name: 'Rename block' }))
    const input = getByLabelText('Block name')
    await user.type(input, 'Highlighted cards')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('Highlighted cards')
  })
})
