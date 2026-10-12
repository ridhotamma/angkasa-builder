/**
 * The inspector: the properties of whatever the editor has picked.
 *
 * A section opens on its Content / Style / Visibility tabs; a block or an
 * element picked inside it opens its own fields with a step back to the
 * section. The theme's header and footer, a frame's details and the theme
 * settings are picked and edited the same way. With nothing picked, it says
 * how to pick something.
 *
 * Every edit rewrites the section it belongs to from the latest sections, so
 * a change from a stale panel can never clobber a newer edit — and a linked
 * copy edits through its original (see `editTargetId`), except for the
 * content fields it overrides.
 */

import { Button, Flex, HStack, Icon, IconButton, Stack, Tabs, Text } from '@chakra-ui/react'
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react'
import type { IconType } from 'react-icons'
import {
  LuArrowDown,
  LuArrowUp,
  LuCopy,
  LuFileText,
  LuLink,
  LuMousePointerClick,
  LuPalette,
  LuTrash2,
  LuUnlink,
  LuX,
} from 'react-icons/lu'

import {
  duplicateBlock,
  findBlock,
  moveBlock,
  removeBlock,
  updateBlockSettings,
  updateBlockStyle,
} from '../model/blocks'
import {
  clearOverrides,
  detachSection,
  linkedMaster,
  overridableFields,
  resolveLinkedSections,
  setBlockOverrides,
  setSectionOverrides,
  type SectionInstance,
} from '../model/content'
import {
  BUTTON_ELEMENT_DEFAULTS,
  BUTTON_ELEMENT_FIELDS,
  TEXT_ELEMENT_DEFAULTS,
  TEXT_ELEMENT_FIELDS,
} from '../model/element-style'
import type { FieldValues } from '../model/fields'
import type { Localized } from '../model/localized'
import {
  FOOTER_FIELDS,
  HEADER_FIELDS,
  LAYOUT_PART_DESCRIPTIONS,
  LAYOUT_PART_NAMES,
  type ThemeLayout,
} from '../model/layout'
import {
  SECTION_STICKY_ENABLED,
  SECTION_STYLE_FIELDS,
  VISIBILITY_STYLE_KEYS,
} from '../model/section-style'
import { sectionSchema } from '../model/sections'
import type { ThemeSettings } from '../model/settings'
import type { SplashShop } from '../render/splash'
import { BlockStylePanel } from './block-style-panel'
import type { FrameDetails } from './builder'
import { FieldsForm } from './controls'
import { SECTION_LINKING_ENABLED } from './features'
import { useEditorText } from './messages'
import { Panel, PanelHeader } from './panel'
import { sectionIcon } from './section-icons'
import {
  DETAILS_ID,
  FOOTER_ID,
  HEADER_ID,
  selectId,
  THEME_ID,
  type Selection,
} from './selection'
import type { EditorServices } from './services'
import { ThemeSettingsPanel } from './theme-settings'

const STYLE_FIELDS = SECTION_STYLE_FIELDS.filter(
  (field) =>
    !(VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key) &&
    // The sticky toggle is built but switched off; see `SECTION_STICKY_ENABLED`.
    (SECTION_STICKY_ENABLED || field.key !== 'sticky'),
)
const VISIBILITY_FIELDS = SECTION_STYLE_FIELDS.filter((field) =>
  (VISIBILITY_STYLE_KEYS as readonly string[]).includes(field.key),
)

type SectionTab = 'content' | 'style' | 'visibility'

/**
 * The section an edit should land on: a linked copy edits its original, so
 * every copy updates together — the component behaviour, not a silent write
 * to a section that draws nothing.
 */
export function editTargetId(sections: readonly SectionInstance[], id: string): string {
  const section = sections.find((other) => other.id === id)
  if (!section?.linkedTo) return id
  return linkedMaster(section, sections)?.id ?? id
}

export interface InspectorProps {
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  /**
   * How the inspector is left: `close` beside the list (an ×, nothing picked
   * afterwards), `back` when it stands in for the list (a step back to it).
   */
  exit: 'close' | 'back'
  /** Fills a fixed-height column and scrolls inside it. */
  fill: boolean
  sections: SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
  services: EditorServices
  layout?: ThemeLayout
  onLayoutChange?: (layout: ThemeLayout) => void
  details?: FrameDetails
  /** The theme settings, when the thing being edited is a theme. */
  theme?: {
    settings: ThemeSettings
    onChange: (settings: ThemeSettings) => void
    shop: SplashShop
    priorityLookKeys?: readonly string[]
  }
}

interface View {
  header: ReactNode
  body: ReactNode
}

export function Inspector(props: InspectorProps) {
  const { selection, onSelectionChange, exit, fill, sections, onSectionsChange } = props
  const { t } = useEditorText()
  // Kept across sections: a seller restyling one section after another stays on Style.
  const [tab, setTab] = useState<SectionTab>('content')

  const updateSection = useCallback(
    (id: string, change: (section: SectionInstance) => SectionInstance) =>
      onSectionsChange(
        sections.map((section) =>
          section.id === editTargetId(sections, id) ? change(section) : section,
        ),
      ),
    [sections, onSectionsChange],
  )

  const leave =
    exit === 'close'
      ? { close: { label: t('closePanel'), onClick: () => onSelectionChange(selectId(null)) } }
      : { back: { label: t('back'), onClick: () => onSelectionChange(selectId(null)) } }

  const view = inspectorView({ ...props, leave, updateSection })

  if (!view) return fill ? <EmptyInspector onOpenTheme={props.theme ? () => onSelectionChange(selectId(THEME_ID)) : undefined} /> : null

  // A section's tabs sit in the fixed header and their panels in the
  // scrolling body: one `Tabs.Root` around both keeps them connected.
  if (view.tabs) {
    return (
      <Tabs.Root
        value={tab}
        onValueChange={({ value }) => setTab(value as SectionTab)}
        size="sm"
        variant="line"
        fitted
        display="flex"
        flexDirection="column"
        h={fill ? 'full' : undefined}
        minH="0"
      >
        <Panel fill={fill} header={view.header}>
          {view.body}
        </Panel>
      </Tabs.Root>
    )
  }

  return (
    <Panel fill={fill} header={view.header}>
      {view.body}
    </Panel>
  )
}

function inspectorView({
  selection,
  onSelectionChange,
  sections,
  onSectionsChange,
  services,
  layout,
  onLayoutChange,
  details,
  theme,
  leave,
  updateSection,
}: InspectorProps & {
  leave: Leave
  updateSection: (id: string, change: (section: SectionInstance) => SectionInstance) => void
}): (View & { tabs?: boolean }) | null {
  const id = selection.id
  if (!id) return null

  if (id === THEME_ID && theme) {
    return {
      header: <ThemeHeader leave={leave} />,
      body: (
        <ThemeSettingsPanel
          settings={theme.settings}
          onChange={theme.onChange}
          shop={theme.shop}
          priorityLookKeys={theme.priorityLookKeys}
        />
      ),
    }
  }

  if (id === DETAILS_ID && details) {
    return {
      header: (
        <PanelHeader
          icon={LuFileText}
          title={details.label}
          description={details.description}
          {...leave}
        />
      ),
      body: details.content,
    }
  }

  const part = id === HEADER_ID ? 'header' : id === FOOTER_ID ? 'footer' : null
  if (part) {
    if (!layout || !onLayoutChange) return null
    return {
      header: <LayoutPartHeader part={part} leave={leave} />,
      body: (
        <Stack gap="4">
          <FieldsForm
            fields={part === 'header' ? HEADER_FIELDS : FOOTER_FIELDS}
            values={layout[part]}
            services={services}
            onChange={(values: FieldValues) => onLayoutChange({ ...layout, [part]: values })}
          />
        </Stack>
      ),
    }
  }

  const selected = sections.find((section) => section.id === id)
  if (!selected) return null
  // A linked copy edits through its original for structure and through its
  // own overrides for content: `source` is the original (schema and master
  // values), `resolved` is what the copy actually draws.
  const source = selected.linkedTo ? (linkedMaster(selected, sections) ?? selected) : selected
  const resolved = selected.linkedTo
    ? (resolveLinkedSections(sections).find((section) => section.id === selected.id) ?? selected)
    : selected
  const schema = sectionSchema(source.type)
  if (!schema) return null

  const toSection = () => onSelectionChange(selectId(selected.id))

  const block = selection.blockId ? findBlock(schema.fields, resolved.settings, selection.blockId) : null
  if (block) {
    return {
      header: (
        <BlockHeader
          name={block.schema.name}
          description={block.schema.description}
          sectionName={schema.name}
          onBack={toSection}
          first={block.index === 0}
          last={block.index >= block.count - 1}
          full={block.count >= block.field.max}
          onMove={(by) =>
            updateSection(selected.id, (section) => {
              const next = moveBlock(schema.fields, section.settings, block.block.id, by)
              return next ? { ...section, settings: next } : section
            })
          }
          onDuplicate={() => {
            const result = duplicateBlock(schema.fields, source.settings, block.block.id)
            if (!result) return
            updateSection(selected.id, (section) => ({ ...section, settings: result.values }))
            onSelectionChange({ id: selected.id, blockId: result.copy.id, element: null })
          }}
          onRemove={() => {
            updateSection(selected.id, (section) => {
              const next = removeBlock(schema.fields, section.settings, block.block.id)
              return next ? { ...section, settings: next } : section
            })
            toSection()
          }}
        />
      ),
      body: (
        <Stack gap="4">
          <FieldsForm
            fields={block.schema.fields}
            values={block.block.settings}
            services={services}
            onChange={(values) => {
              // A linked copy's block content is its own; structure still
              // belongs to the original, which `setBlockOverrides` routes.
              if (selected.linkedTo) {
                onSectionsChange(setBlockOverrides(sections, selected.id, block.block.id, values))
                return
              }
              updateSection(selected.id, (section) => {
                const settings = updateBlockSettings(
                  schema.fields,
                  section.settings,
                  block.block.id,
                  values,
                )
                return settings ? { ...section, settings } : section
              })
            }}
          />
          {block.field.styleFields && (
            <BlockStylePanel
              fields={block.field.styleFields}
              values={block.block.style ?? {}}
              services={services}
              onChange={(style) =>
                updateSection(selected.id, (section) => {
                  const settings = updateBlockStyle(
                    schema.fields,
                    section.settings,
                    block.block.id,
                    style,
                  )
                  return settings ? { ...section, settings } : section
                })
              }
            />
          )}
        </Stack>
      ),
    }
  }

  const element = selection.element
  if (element) {
    const text = element.kind === 'text'
    return {
      header: (
        <ElementHeader text={text} sectionName={schema.name} onBack={toSection} />
      ),
      body: (
        <ElementBody
          text={text}
          values={source.elements?.[element.id]}
          services={services}
          onChange={(values) =>
            updateSection(selected.id, (section) => ({
              ...section,
              elements: { ...(section.elements ?? {}), [element.id]: values },
            }))
          }
          onReset={() =>
            updateSection(selected.id, (section) => {
              const current = section.elements
              if (!current?.[element.id]) return section
              const { [element.id]: _reset, ...remaining } = current
              if (Object.keys(remaining).length === 0) {
                const { elements: _cleared, ...rest } = section
                return rest
              }
              return { ...section, elements: remaining }
            })
          }
        />
      ),
    }
  }

  if (SECTION_LINKING_ENABLED && selected.linkedTo) {
    return {
      header: (
        <SectionHeader icon={LuLink} name={schema.name} description={null} leave={leave} />
      ),
      body: (
        <LinkedSectionBody
          selected={selected}
          resolved={resolved}
          source={source}
          sections={sections}
          onSectionsChange={onSectionsChange}
          services={services}
          onEditMaster={() => onSelectionChange(selectId(selected.linkedTo!))}
        />
      ),
    }
  }

  return {
    tabs: true,
    header: (
      <SectionHeader
        icon={sectionIcon(schema.icon)}
        name={schema.name}
        description={schema.description}
        leave={leave}
        tabs={<SectionTabs />}
      />
    ),
    body: (
      <>
        <Tabs.Content value="content" p="0">
          <Stack gap="4">
            {schema.fields.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                <SchemaText text={schema.description} />
              </Text>
            ) : (
              <FieldsForm
                fields={schema.fields}
                values={selected.settings}
                services={services}
                onChange={(values) =>
                  updateSection(selected.id, (section) => ({ ...section, settings: values }))
                }
              />
            )}
          </Stack>
        </Tabs.Content>
        <Tabs.Content value="style" p="0">
          <Stack gap="4">
            <FieldsForm
              fields={STYLE_FIELDS}
              values={selected.style}
              services={services}
              onChange={(style) => updateSection(selected.id, (section) => ({ ...section, style }))}
            />
          </Stack>
        </Tabs.Content>
        <Tabs.Content value="visibility" p="0">
          <Stack gap="4">
            <FieldsForm
              fields={VISIBILITY_FIELDS}
              values={selected.style}
              services={services}
              onChange={(style) => updateSection(selected.id, (section) => ({ ...section, style }))}
            />
          </Stack>
        </Tabs.Content>
      </>
    ),
  }
}

/* -------------------------------------------------------------------------- */
/* Headers                                                                    */
/*                                                                            */
/* Small components rather than inline JSX: `inspectorView` is a plain        */
/* function, and these are what read the editor's text through its hook.     */
/* -------------------------------------------------------------------------- */

type Leave = Pick<ComponentProps<typeof PanelHeader>, 'back' | 'close'>

function SchemaText({ text }: { text: Localized }) {
  const { l } = useEditorText()
  return <>{l(text)}</>
}

function ThemeHeader({ leave }: { leave: Leave }) {
  const { t } = useEditorText()
  return (
    <PanelHeader
      icon={LuPalette}
      title={t('themeSettings')}
      description={t('themeSettingsHelp')}
      {...leave}
    />
  )
}

function LayoutPartHeader({ part, leave }: { part: 'header' | 'footer'; leave: Leave }) {
  const { l } = useEditorText()
  return (
    <PanelHeader
      icon={sectionIcon(part)}
      title={l(LAYOUT_PART_NAMES[part])}
      description={l(LAYOUT_PART_DESCRIPTIONS[part])}
      {...leave}
    />
  )
}

function SectionHeader({
  icon,
  name,
  description,
  leave,
  tabs,
}: {
  icon: IconType
  name: Localized
  description: Localized | null
  leave: Leave
  tabs?: ReactNode
}) {
  const { l } = useEditorText()
  return (
    <PanelHeader
      icon={icon}
      title={l(name)}
      description={description ? l(description) : undefined}
      tabs={tabs}
      {...leave}
    />
  )
}

function SectionTabs() {
  const { t } = useEditorText()
  return (
    <Tabs.List mx="-4" px="2">
      <Tabs.Trigger value="content">{t('sectionContent')}</Tabs.Trigger>
      <Tabs.Trigger value="style">{t('sectionStyle')}</Tabs.Trigger>
      <Tabs.Trigger value="visibility">{t('sectionVisibility')}</Tabs.Trigger>
    </Tabs.List>
  )
}

function BlockHeader({
  name,
  description,
  sectionName,
  onBack,
  first,
  last,
  full,
  onMove,
  onDuplicate,
  onRemove,
}: {
  name: Localized
  description?: Localized
  sectionName: Localized
  onBack: () => void
  first: boolean
  last: boolean
  full: boolean
  onMove: (by: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { t, l } = useEditorText()
  const action = (label: string, glyph: IconType, onClick: () => void, disabled = false, danger = false) => (
    <IconButton
      aria-label={label}
      title={label}
      size="xs"
      variant="outline"
      colorPalette={danger ? 'danger' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon as={glyph} />
    </IconButton>
  )
  return (
    <PanelHeader
      title={l(name)}
      description={description ? l(description) : undefined}
      back={{ label: `${t('backTo')} ${l(sectionName)}`, onClick: onBack }}
      actions={
        <>
          {action(t('moveUp'), LuArrowUp, () => onMove(-1), first)}
          {action(t('moveDown'), LuArrowDown, () => onMove(1), last)}
          {action(t('duplicate'), LuCopy, onDuplicate, full)}
          {action(t('remove'), LuTrash2, onRemove, false, true)}
        </>
      }
    />
  )
}

function ElementHeader({
  text,
  sectionName,
  onBack,
}: {
  text: boolean
  sectionName: Localized
  onBack: () => void
}) {
  const { t, l } = useEditorText()
  return (
    <PanelHeader
      title={text ? t('textElement') : t('buttonElement')}
      description={text ? t('textElementHelp') : t('buttonElementHelp')}
      back={{ label: `${t('backTo')} ${l(sectionName)}`, onClick: onBack }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Bodies                                                                     */
/* -------------------------------------------------------------------------- */

function ElementBody({
  text,
  values,
  services,
  onChange,
  onReset,
}: {
  text: boolean
  values: FieldValues | undefined
  services: EditorServices
  onChange: (values: FieldValues) => void
  onReset: () => void
}) {
  const { t } = useEditorText()
  return (
    <Stack gap="4">
      <FieldsForm
        fields={text ? TEXT_ELEMENT_FIELDS : BUTTON_ELEMENT_FIELDS}
        values={values ?? (text ? { ...TEXT_ELEMENT_DEFAULTS } : { ...BUTTON_ELEMENT_DEFAULTS })}
        services={services}
        onChange={onChange}
      />
      <Button size="xs" variant="outline" alignSelf="start" disabled={!values} onClick={onReset}>
        {t('resetToTheme')}
      </Button>
    </Stack>
  )
}

function LinkedSectionBody({
  selected,
  resolved,
  source,
  sections,
  onSectionsChange,
  services,
  onEditMaster,
}: {
  selected: SectionInstance
  resolved: SectionInstance
  source: SectionInstance
  sections: SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
  services: EditorServices
  onEditMaster: () => void
}) {
  const { t, l } = useEditorText()
  const schema = sectionSchema(source.type)
  if (!schema) return null
  const fields = overridableFields(schema.fields)

  const resetRow = (key: string, label: string, onReset: () => void) => (
    <HStack key={key} gap="2" justify="space-between">
      <Text fontSize="xs" color="fg.muted" truncate>
        {label}
      </Text>
      <IconButton aria-label={t('resetOverride')} size="2xs" variant="ghost" onClick={onReset}>
        <LuX />
      </IconButton>
    </HStack>
  )

  return (
    <Stack gap="4">
      <Text fontSize="xs" color="fg.muted">
        {t('linkedHelp')}
      </Text>
      {fields.length > 0 && (
        <FieldsForm
          fields={fields}
          values={resolved.settings}
          services={services}
          onChange={(values) => onSectionsChange(setSectionOverrides(sections, selected.id, values))}
        />
      )}
      {selected.overrides && (
        <Stack gap="1" borderTopWidth="1px" borderColor="border.subtle" pt="3">
          <Text fontSize="xs" fontWeight="semibold">
            {t('overridesTitle')}
          </Text>
          {Object.keys(selected.overrides.fields ?? {}).map((key) => {
            const field = fields.find((entry) => entry.key === key)
            return resetRow(key, field ? l(field.label) : key, () =>
              onSectionsChange(clearOverrides(sections, selected.id, { field: key })),
            )
          })}
          {Object.keys(selected.overrides.blocks ?? {}).map((blockId) => {
            const found = findBlock(schema.fields, source.settings, blockId)
            return resetRow(blockId, found ? l(found.schema.name) : blockId, () =>
              onSectionsChange(clearOverrides(sections, selected.id, { blockId })),
            )
          })}
        </Stack>
      )}
      <HStack gap="2" wrap="wrap">
        {sections.some((section) => section.id === selected.linkedTo) && (
          <Button size="xs" variant="outline" onClick={onEditMaster}>
            <Icon as={LuLink} />
            {t('editMaster')}
          </Button>
        )}
        <Button
          size="xs"
          variant="outline"
          onClick={() => onSectionsChange(detachSection(sections, selected.id))}
        >
          <Icon as={LuUnlink} />
          {t('detach')}
        </Button>
        {selected.overrides && (
          <Button
            size="xs"
            variant="ghost"
            colorPalette="danger"
            onClick={() => onSectionsChange(clearOverrides(sections, selected.id))}
          >
            {t('resetAll')}
          </Button>
        )}
      </HStack>
    </Stack>
  )
}

/** Nothing picked: how to pick something, and a way to the theme settings. */
function EmptyInspector({ onOpenTheme }: { onOpenTheme?: () => void }) {
  const { t } = useEditorText()
  return (
    <Flex direction="column" align="center" justify="center" textAlign="center" h="full" gap="3" px="8">
      <Flex boxSize="10" rounded="full" bg="bg.muted" align="center" justify="center" color="fg.muted">
        <Icon as={LuMousePointerClick} boxSize="5" />
      </Flex>
      <Stack gap="1">
        <Text fontSize="sm" fontWeight="semibold">
          {t('inspectorEmpty')}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {t('inspectorEmptyHelp')}
        </Text>
      </Stack>
      {onOpenTheme && (
        <Button size="xs" variant="outline" mt="1" onClick={onOpenTheme}>
          <Icon as={LuPalette} />
          {t('themeSettings')}
        </Button>
      )}
    </Flex>
  )
}
