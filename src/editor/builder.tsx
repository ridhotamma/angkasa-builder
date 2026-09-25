/**
 * The editor: section list and settings on the left, live preview beside it.
 *
 * Shopify-shaped. The left panel is either the list of sections (plus the
 * theme tab, when the thing being edited is a theme) or, once a section is
 * picked, that section's settings with a way back. Clicking a section in the
 * preview picks it too.
 *
 * Fully controlled: the screen owns the document and decides when to save.
 * This component only ever calls `onSectionsChange` / `onSettingsChange` with
 * a new value.
 */

import {
  Button,
  Container,
  Flex,
  Grid,
  Icon,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import { LuChevronLeft } from 'react-icons/lu'

import type { SectionInstance } from '../model/content'
import { sectionSchema } from '../model/sections'
import { googleFontsHref, type ThemeSettings } from '../model/settings'
import type { RenderEnvironment, StorefrontRenderData } from '../render/context'
import { PAGE_WIDTH_CONTAINER } from '../render/primitives'
import { SectionsRenderer, ThemeScope } from '../render/renderer'
import { FieldsForm } from './controls'
import { useEditorText } from './messages'
import { SectionList } from './section-list'
import type { EditorServices } from './services'
import { ThemeSettingsPanel } from './theme-settings'

export interface PageBuilderProps {
  sections: SectionInstance[]
  onSectionsChange: (sections: SectionInstance[]) => void
  settings: ThemeSettings
  /** Omit to edit sections only, e.g. a page previewed under the shop's theme. */
  onSettingsChange?: (settings: ThemeSettings) => void
  data: StorefrontRenderData
  services: EditorServices
  formatPrice: RenderEnvironment['formatPrice']
  /** Rendered above the preview, e.g. save and publish buttons. */
  toolbar?: ReactNode
  /** Said above the preview before the "click a section" hint, e.g. which theme it uses. */
  previewNote?: string
  /** The height the editor fills (a length or `100%`); panels scroll inside it. */
  height?: string
}

export function PageBuilder({
  sections,
  onSectionsChange,
  settings,
  onSettingsChange,
  data,
  services,
  formatPrice,
  toolbar,
  previewNote,
  height = 'calc(100dvh - 9rem)',
}: PageBuilderProps) {
  const { t, l } = useEditorText()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'sections' | 'theme'>('sections')

  const selected = sections.find((section) => section.id === selectedId) ?? null
  const schema = selected ? sectionSchema(selected.type) : null

  const env: RenderEnvironment = {
    data,
    settings,
    mode: 'preview',
    imageUrl: services.imageUrl,
    formatPrice,
  }

  function select(id: string) {
    setSelectedId(id)
    setTab('sections')
  }

  const panel =
    selected && schema ? (
      <Stack gap="4">
        <Button
          size="xs"
          variant="ghost"
          alignSelf="start"
          ml="-2"
          onClick={() => setSelectedId(null)}
        >
          <Icon as={LuChevronLeft} />
          {t('back')}
        </Button>
        <Stack gap="1">
          <Text fontWeight="semibold">{l(schema.name)}</Text>
          <Text fontSize="xs" color="fg.muted">
            {l(schema.description)}
          </Text>
        </Stack>
        <FieldsForm
          fields={schema.fields}
          values={selected.settings}
          services={services}
          onChange={(values) =>
            onSectionsChange(
              sections.map((section) =>
                section.id === selected.id ? { ...section, settings: values } : section,
              ),
            )
          }
        />
      </Stack>
    ) : onSettingsChange ? (
      <Tabs.Root
        value={tab}
        onValueChange={({ value }) => setTab(value as 'sections' | 'theme')}
        size="sm"
        variant="line"
        fitted
      >
        <Tabs.List mb="4">
          <Tabs.Trigger value="sections">{t('sections')}</Tabs.Trigger>
          <Tabs.Trigger value="theme">{t('theme')}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="sections" p="0">
          <SectionList
            sections={sections}
            onChange={onSectionsChange}
            selectedId={selectedId}
            onSelect={select}
          />
        </Tabs.Content>
        <Tabs.Content value="theme" p="0">
          <ThemeSettingsPanel settings={settings} onChange={onSettingsChange} />
        </Tabs.Content>
      </Tabs.Root>
    ) : (
      <SectionList
        sections={sections}
        onChange={onSectionsChange}
        selectedId={selectedId}
        onSelect={select}
      />
    )

  return (
    <Grid
      templateColumns={{ base: '1fr', lg: '20rem 1fr', '2xl': '24rem 1fr' }}
      gap="4"
      h={{ lg: height }}
      minH="0"
    >
      <ScrollArea.Root
        size="xs"
        h={{ lg: 'full' }}
        minH="0"
        minW="0"
        borderWidth="1px"
        borderColor="border.subtle"
        rounded="lg"
        bg="bg.panel"
      >
        <ScrollArea.Viewport>
          {/* Zag gives the content an inline `min-width: fit-content`, which
              lets one long line — a help text, a long caption typed into an
              input — push the whole panel wider than its column and clip the
              controls. The panel only ever scrolls vertically. */}
          <ScrollArea.Content p="4" style={{ minWidth: 0 }}>
            {panel}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar />
      </ScrollArea.Root>

      <Flex direction="column" gap="3" minH="0" minW="0">
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Text fontSize="xs" color="fg.muted">
            {previewNote ? `${previewNote} ` : ''}
            {t('previewNote')}
          </Text>
          {toolbar}
        </Flex>
        {/* React 19 hoists this into <head> and de-duplicates it by href. */}
        <link rel="stylesheet" href={googleFontsHref(settings)} precedence="default" />
        <ScrollArea.Root
          flex="1"
          h={{ base: '32rem', lg: 'auto' }}
          minH="0"
          rounded="lg"
          borderWidth="1px"
          borderColor="border.subtle"
          overflow="hidden"
        >
          <ScrollArea.Viewport>
            {/* The page is laid out at the pane's width, as a storefront is at
                the window's — not at the widest thing on it, which Zag's inline
                `min-width: fit-content` would otherwise allow (a marquee's
                natural width is its whole strip of cards). */}
            <ScrollArea.Content style={{ minWidth: 0 }}>
              <ThemeScope settings={settings} minH="full" {...PAGE_WIDTH_CONTAINER}>
                <Container maxW="6xl" py={{ base: '6', md: '10' }}>
                  <SectionsRenderer
                    sections={sections}
                    env={env}
                    selectedId={selectedId}
                    onSelect={select}
                  />
                </Container>
              </ThemeScope>
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar />
        </ScrollArea.Root>
      </Flex>
    </Grid>
  )
}
