import './happy-dom-setup'

import { afterEach, describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { BuilderDialog, useBuilderDialogChildOverlay } from '../src/editor/builder-dialog'
import { CommandPalette } from '../src/editor/command-palette'
import { createSection } from '../src/model/content'

afterEach(() => cleanup())

function wrap(node: ReactNode) {
  return (
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>
  )
}

function ChildOverlay({ open }: { open: boolean }) {
  useBuilderDialogChildOverlay(open)
  return open ? <div>child overlay</div> : null
}

describe('the editor dialog and its add search', () => {
  test('Escape closes the child overlay, not the editor underneath it', async () => {
    const user = userEvent.setup()
    let closed = 0
    const { rerender } = render(
      wrap(
        <BuilderDialog title="Editor" dirty={false} onClose={() => (closed += 1)}>
          <ChildOverlay open />
        </BuilderDialog>,
      ),
    )

    await waitFor(() => expect(document.body.textContent).toContain('child overlay'))
    await user.keyboard('{Escape}')
    expect(closed).toBe(0)

    rerender(
      wrap(
        <BuilderDialog title="Editor" dirty={false} onClose={() => (closed += 1)}>
          <ChildOverlay open={false} />
        </BuilderDialog>,
      ),
    )
    await waitFor(() => expect(document.body.textContent).not.toContain('child overlay'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(closed).toBe(1))
  })

  test('"+ Add block" mode only offers blocks, never sections', () => {
    const sections = [createSection('blocks', { blocks: [] })]
    render(
      wrap(
        <CommandPalette
          open
          onClose={() => undefined}
          sections={sections}
          scope="home"
          counts={new Map()}
          onOpenSection={() => undefined}
          onAddSection={() => undefined}
          onAddBlocks={() => undefined}
          addOnly
          blocksOnly
        />,
      ),
    )

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('Add a block')
    expect(dialog?.textContent).not.toContain('Add a section')
  })
})
