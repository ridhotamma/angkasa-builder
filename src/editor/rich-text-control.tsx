/**
 * The rich-text field's control: Tiptap with a small toolbar.
 *
 * Tiptap is configured down to exactly the vocabulary `../model/rich-text`
 * keeps — no code blocks, rules or third heading level — so nothing a seller
 * can make here is silently dropped when the layout is saved. The document is
 * handed up as Tiptap's JSON, which is the stored shape once sanitised.
 */

import {
  Box,
  Button,
  Field,
  HStack,
  IconButton,
  Input,
  Popover,
  Portal,
  Separator,
  Stack,
} from '@chakra-ui/react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useId, useState, type ComponentType } from 'react'
import {
  LuBold,
  LuHeading2,
  LuHeading3,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuQuote,
  LuRemoveFormatting,
  LuStrikethrough,
  LuUnderline,
} from 'react-icons/lu'

import { Tooltip } from '../ui'

import { isSafeRichHref, type RichDoc } from '../model/rich-text'
import { useEditorText, type EditorMessage } from './messages'

export function RichTextControl({
  value,
  onChange,
}: {
  value: RichDoc
  onChange: (value: RichDoc) => void
}) {
  const editor = useEditor({
    // The admin renders on the server first; Tiptap must wait for the client.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, isAllowedUri: (url) => isSafeRichHref(url) },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDoc),
  })

  // The same control is reused when the seller switches between two sections
  // of the same type, so a value that changed from outside is loaded in.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      rounded="l2"
      bg="bg"
      _focusWithin={{
        borderColor: 'colorPalette.focusRing',
        outline: '1px solid',
        outlineColor: 'colorPalette.focusRing',
      }}
      colorPalette="brand"
    >
      {editor && <Toolbar editor={editor} />}
      <Box
        px="3"
        py="2"
        fontSize="sm"
        maxH="20rem"
        overflowY="auto"
        css={{
          '& .tiptap': { outline: 'none', minHeight: '6rem' },
          '& .tiptap > * + *': { marginTop: '0.6em' },
          '& .tiptap h2': { fontSize: 'lg', fontWeight: 'semibold' },
          '& .tiptap h3': { fontSize: 'md', fontWeight: 'semibold' },
          '& .tiptap ul': { listStyleType: 'disc', paddingInlineStart: '1.25rem' },
          '& .tiptap ol': { listStyleType: 'decimal', paddingInlineStart: '1.25rem' },
          '& .tiptap blockquote': {
            borderInlineStartWidth: '3px',
            borderColor: 'border.emphasized',
            paddingInlineStart: '0.75rem',
            color: 'fg.muted',
          },
          '& .tiptap a': { color: 'brand.fg', textDecoration: 'underline' },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-rendered only when a button's active state actually changes.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      heading2: editor.isActive('heading', { level: 2 }),
      heading3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
    }),
  })

  const chain = () => editor.chain().focus()

  return (
    <HStack
      gap="0.5"
      px="1.5"
      py="1"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      wrap="wrap"
    >
      <ToolButton
        icon={LuBold}
        label="bold"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        icon={LuItalic}
        label="italic"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={LuUnderline}
        label="underline"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        icon={LuStrikethrough}
        label="strike"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <Separator orientation="vertical" h="4" mx="1" />
      <ToolButton
        icon={LuHeading2}
        label="heading2"
        active={state.heading2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={LuHeading3}
        label="heading3"
        active={state.heading3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        icon={LuList}
        label="bulletList"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        icon={LuListOrdered}
        label="orderedList"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        icon={LuQuote}
        label="quote"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <Separator orientation="vertical" h="4" mx="1" />
      <LinkButton editor={editor} active={state.link} />
      <ToolButton
        icon={LuRemoveFormatting}
        label="clearFormatting"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
    </HStack>
  )
}

function ToolButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: ComponentType
  label: EditorMessage
  active?: boolean
  onClick: () => void
}) {
  const { t } = useEditorText()
  return (
    <Tooltip content={t(label)}>
      <IconButton
        aria-label={t(label)}
        aria-pressed={active}
        size="xs"
        variant={active ? 'subtle' : 'ghost'}
        colorPalette={active ? 'brand' : 'gray'}
        // Keeps the editor's selection: a click would otherwise blur it first.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <Icon />
      </IconButton>
    </Tooltip>
  )
}

/** A link is typed into a small popover, and refused unless it is safe to follow. */
function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const { t } = useEditorText()
  // Shared by the popover and its tooltip, which wrap the same button.
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')
  const [invalid, setInvalid] = useState(false)

  function apply() {
    const next = href.trim()
    if (!next) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setOpen(false)
      return
    }
    if (!isSafeRichHref(next)) {
      setInvalid(true)
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run()
    setOpen(false)
  }

  return (
    <Popover.Root
      ids={{ trigger: triggerId }}
      open={open}
      onOpenChange={({ open: next }) => {
        if (next) {
          setHref((editor.getAttributes('link').href as string | undefined) ?? '')
          setInvalid(false)
        }
        setOpen(next)
      }}
      positioning={{ placement: 'bottom-start' }}
    >
      <Tooltip content={t('link')} triggerId={triggerId}>
        <Popover.Trigger asChild>
          <IconButton
            aria-label={t('link')}
            aria-pressed={active}
            size="xs"
            variant={active ? 'subtle' : 'ghost'}
            colorPalette={active ? 'brand' : 'gray'}
            onMouseDown={(event) => event.preventDefault()}
          >
            <LuLink />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="xs" maxW="calc(100vw - 2rem)">
            <Popover.Body p="3">
              <Stack gap="2">
                <Field.Root invalid={invalid}>
                  <Input
                    size="sm"
                    autoFocus
                    value={href}
                    placeholder={t('linkPlaceholder')}
                    onChange={(event) => {
                      setHref(event.currentTarget.value)
                      setInvalid(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        apply()
                      }
                    }}
                  />
                  {invalid && <Field.ErrorText>{t('linkInvalid')}</Field.ErrorText>}
                </Field.Root>
                <HStack justify="flex-end">
                  {active && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorPalette="danger"
                      me="auto"
                      onClick={() => {
                        editor.chain().focus().extendMarkRange('link').unsetLink().run()
                        setOpen(false)
                      }}
                    >
                      {t('removeLink')}
                    </Button>
                  )}
                  <Button size="xs" colorPalette="brand" onClick={apply}>
                    {t('applyLink')}
                  </Button>
                </HStack>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
