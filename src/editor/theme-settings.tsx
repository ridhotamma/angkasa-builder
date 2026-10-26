/** The theme tab: colours, fonts and shape, with the contrast check live. */

import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Portal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import {
  LuArrowUpFromLine,
  LuCircleSlash,
  LuLayers,
  LuRotate3D,
  LuSparkle,
  LuSparkles,
  LuSquare,
  LuWandSparkles,
  LuZoomIn,
} from 'react-icons/lu'

import {
  ANIMATION_LABELS,
  ANIMATION_STYLES,
  BUTTON_STYLES,
  CARD_HOVER_EFFECTS,
  CARD_HOVER_LABELS,
  CARD_STYLES,
  contrastIssues,
  DENSITIES,
  DENSITY_LABELS,
  OPTION_LABELS,
  PAGE_WIDTH_LABELS,
  PAGE_WIDTHS,
  POPUP_KIND_LABELS,
  POPUP_KINDS,
  RADIUS_OPTIONS,
  resolveScheme,
  SCHEME_KEYS,
  SCHEME_LABELS,
  schemeContrastIssues,
  SPLASH_STYLE_LABELS,
  SPLASH_STYLES,
  SPLASH_TONE_LABELS,
  SPLASH_TONES,
  TYPE_SCALE_LABELS,
  TYPE_SCALES,
  type FontFamily,
  type PopupKind,
  type SchemeColors,
  type SplashStyle,
  type SplashTone,
  type ThemeSettings,
} from '../model/settings'
import type { SectionInstance } from '../model/content'
import type { StorefrontLocale } from '../model/localized'
import { SitePopup } from '../render/popup'
import { SplashScreen, type SplashShop } from '../render/splash'
import { ChoiceCards, ToggleCards } from './choice-cards'
import { ColorInput, Labeled, SelectInput } from './controls'
import { FontSelect } from './font-select'
import { LookPickerDialog } from './look-picker-dialog'
import { TranslationManagerDialog } from './translation-manager-dialog'
import { useEditorText, type EditorMessage } from './messages'
import { PaletteStrip } from './palette-swatch'
import { PropertyGroup } from './property-group'

function Heading({ children }: { children: string }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      textTransform="uppercase"
      letterSpacing="wide"
      color="fg.muted"
    >
      {children}
    </Text>
  )
}

/* -------------------------------------------------------------------------- */
/* Previews: each option drawn as what it does                                */
/* -------------------------------------------------------------------------- */

const RADIUS_PX: Record<ThemeSettings['radius'], string> = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '14px',
}

function RadiusPreview({ radius }: { radius: ThemeSettings['radius'] }) {
  return (
    <Box
      w="9"
      h="7"
      borderTopWidth="2.5px"
      borderLeftWidth="2.5px"
      borderColor="currentColor"
      style={{
        borderTopLeftRadius: RADIUS_PX[radius] === '0' ? 0 : `calc(${RADIUS_PX[radius]} * 1.6)`,
      }}
      ms="3"
      mt="3"
    />
  )
}

function ButtonPreview({ style }: { style: ThemeSettings['buttonStyle'] }) {
  const filled = style !== 'outline'
  return (
    <Box
      px="3"
      h="6"
      display="flex"
      alignItems="center"
      fontSize="10px"
      fontWeight="semibold"
      rounded={style === 'pill' ? 'full' : 'sm'}
      bg={filled ? 'currentColor' : 'transparent'}
      borderWidth={style === 'hard' ? '2px' : style === 'outline' ? '1.5px' : '0'}
      borderColor={style === 'hard' ? 'fg' : 'currentColor'}
      boxShadow={style === 'hard' ? '2px 2px 0 var(--chakra-colors-fg)' : undefined}
    >
      <Box as="span" color={filled ? 'bg.panel' : 'currentColor'}>
        Beli
      </Box>
    </Box>
  )
}

function CardPreview({ style }: { style: ThemeSettings['cardStyle'] }) {
  return (
    <Box
      w="12"
      h="10"
      p="1"
      rounded="sm"
      bg={style === 'flat' ? 'bg.muted' : 'bg.panel'}
      borderWidth={style === 'border' ? '1px' : style === 'hard' ? '2px' : '0'}
      borderColor={style === 'hard' ? 'fg' : 'border.emphasized'}
      boxShadow={
        style === 'shadow'
          ? 'md'
          : style === 'hard'
            ? '3px 3px 0 var(--chakra-colors-fg)'
            : undefined
      }
    >
      <Box h="4" rounded="2px" bg="currentColor" opacity="0.3" />
      <Box h="1" w="70%" mt="1" rounded="full" bg="currentColor" opacity="0.6" />
    </Box>
  )
}

const TYPE_SIZE: Record<ThemeSettings['typeScale'], string> = {
  compact: 'sm',
  default: 'lg',
  large: '2xl',
}

const DENSITY_GAP: Record<ThemeSettings['density'], string> = {
  tight: '0.5',
  cozy: '1.5',
  airy: '2.5',
}

const PAGE_FILL: Record<ThemeSettings['pageWidth'], string> = {
  narrow: '45%',
  default: '70%',
  wide: '92%',
}

function DensityPreview({ density }: { density: ThemeSettings['density'] }) {
  return (
    <Stack gap={DENSITY_GAP[density]} w="10">
      {[0, 1, 2].map((index) => (
        <Box key={index} h="1.5" rounded="full" bg="currentColor" opacity="0.6" />
      ))}
    </Stack>
  )
}

function PageWidthPreview({ width }: { width: ThemeSettings['pageWidth'] }) {
  return (
    <Box
      w="14"
      h="9"
      rounded="sm"
      borderWidth="1.5px"
      borderColor="currentColor"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="1"
      opacity="0.85"
    >
      {[0, 1].map((index) => (
        <Box
          key={index}
          h="1.5"
          rounded="full"
          bg="currentColor"
          style={{ width: PAGE_FILL[width] }}
        />
      ))}
    </Box>
  )
}

const ANIMATION_GLYPHS: Record<ThemeSettings['animation'], typeof LuSparkles> = {
  none: LuCircleSlash,
  subtle: LuSparkle,
  expressive: LuWandSparkles,
}

const HOVER_GLYPHS: Record<(typeof CARD_HOVER_EFFECTS)[number], typeof LuSparkles> = {
  outline: LuSquare,
  zoom: LuZoomIn,
  lift: LuArrowUpFromLine,
  shadow: LuLayers,
  tilt: LuRotate3D,
  shine: LuSparkles,
}

/** "Subtle — fade in" → "Subtle": the card names it, the tooltip explains. */
function shortLabel(label: string): string {
  return label.split(' — ')[0]!.split(' (')[0]!
}

/**
 * One collapsible group in the Theme tab, the same accordion the block-style
 * overrides use: the whole settings list reads as a short set of headings and
 * opens only where the seller is working.
 */
function ThemeSection({
  value,
  title,
  helper,
  children,
}: {
  value: string
  title: string
  /** A line of context under the heading, in the section's voice. */
  helper?: string
  children: ReactNode
}) {
  return (
    <PropertyGroup value={value} title={title} helper={helper}>
      {children}
    </PropertyGroup>
  )
}

export function ThemeSettingsPanel({
  settings,
  onChange,
  shop,
  priorityLookKeys = [],
  sections,
  onSectionsChange,
  defaultLocale,
  onTranslate,
}: {
  settings: ThemeSettings
  onChange: (settings: ThemeSettings) => void
  /** The shop's own name and logo, for the splash replay. */
  shop?: SplashShop
  /** Look keys a freshly installed template suggests, shown first. */
  priorityLookKeys?: readonly string[]
  /**
   * The page's sections. Given together with `onSectionsChange`, the Localization
   * group appears — translating needs the copy the sections hold.
   */
  sections?: readonly SectionInstance[]
  onSectionsChange?: (sections: SectionInstance[]) => void
  /** The shop's own language: a plain string is seeded here. Defaults to `id`. */
  defaultLocale?: StorefrontLocale
  /** The host's AI, for the translation manager's auto-translate button. */
  onTranslate?: (input: {
    from: StorefrontLocale
    to: StorefrontLocale
    texts: string[]
  }) => Promise<string[]>
}) {
  const { t, l } = useEditorText()
  // The picker opens only when the seller asks for it: a modal that opens
  // itself on a fresh theme or install is one more thing to dismiss, and
  // dismissing it could take the editor down with it.
  const [pickerOpen, setPickerOpen] = useState(false)
  // A count, so each press replays the intro; zero means it is not playing.
  const [splashPreview, setSplashPreview] = useState(0)
  /** Whether the translation manager is open. */
  const [translationOpen, setTranslationOpen] = useState(false)
  const [popupPreview, setPopupPreview] = useState(0)
  const issues = contrastIssues(settings)
  const schemeIssues = schemeContrastIssues(settings)

  const splashToggle = (
    label: string,
    key: 'enabled' | 'showLogo' | 'showName' | 'oncePerSession',
  ) => (
    <HStack key={key} justify="space-between" w="full" align="flex-start" gap="4">
      <Text fontSize="sm">{label}</Text>
      <Switch.Root
        size="sm"
        colorPalette="brand"
        checked={settings.splash[key]}
        onCheckedChange={({ checked }) =>
          onChange({ ...settings, splash: { ...settings.splash, [key]: checked } })
        }
      >
        <Switch.HiddenInput />
        <Switch.Control />
      </Switch.Root>
    </HStack>
  )

  const color = (key: keyof ThemeSettings['colors'], label: EditorMessage) => (
    <ColorInput
      label={t(label)}
      value={settings.colors[key]}
      onChange={(value) => onChange({ ...settings, colors: { ...settings.colors, [key]: value } })}
    />
  )

  return (
    <Stack gap="6">
      {/* Curated Looks & Palettes Quick Selector */}
      <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" p="3.5" bg="bg.subtle">
        <Flex justify="space-between" align="center" mb="2">
          <Heading>{t('looksAndPalettes')}</Heading>
          <Badge size="xs" variant="surface">
            {settings.fonts.heading} / {settings.fonts.body}
          </Badge>
        </Flex>

        <HStack
          gap="0"
          h="4"
          rounded="sm"
          overflow="hidden"
          mb="3"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <PaletteStrip colors={settings.colors} />
        </HStack>

        <Button
          size="sm"
          variant="outline"
          w="100%"
          colorPalette="brand"
          onClick={() => setPickerOpen(true)}
        >
          <Icon as={LuSparkles} />
          <span>{t('browseLooks')}</span>
        </Button>
      </Box>

      <LookPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        settings={settings}
        onApply={onChange}
        priorityKeys={priorityLookKeys}
      />

      <Accordion.Root multiple defaultValue={['colors']}>
        <ThemeSection value="colors" title={t('colors')}>
          <SimpleGrid columns={2} gap="3">
            {color('brand', 'brandColor')}
            {color('background', 'backgroundColor')}
            {color('text', 'textColor')}
            {color('accent', 'accentColor')}
          </SimpleGrid>
          {issues.map((issue) => (
            <Alert.Root key={issue} status="warning" size="sm">
              <Alert.Indicator />
              <Alert.Description>
                {t(issue === 'text' ? 'contrastText' : 'contrastBrand')}
              </Alert.Description>
            </Alert.Root>
          ))}
        </ThemeSection>

        <ThemeSection value="schemes" title={t('colorSchemes')} helper={t('colorSchemesHelp')}>
          {SCHEME_KEYS.map((key) => {
            const own = settings.schemes[key]
            const colors = resolveScheme(settings, key)
            const invalid = schemeIssues.includes(key)
            const setScheme = (scheme: SchemeColors | undefined) => {
              const schemes = { ...settings.schemes }
              if (scheme) schemes[key] = scheme
              else delete schemes[key]
              onChange({ ...settings, schemes })
            }
            return (
              <Box
                key={key}
                borderWidth="1px"
                borderColor={invalid ? 'warning.emphasized' : 'border.subtle'}
                rounded="md"
                p="2.5"
              >
                <HStack gap="2.5">
                  {/* A swatch that is the scheme: its background, its text, its button. */}
                  <HStack
                    gap="1"
                    px="2"
                    py="1.5"
                    rounded="sm"
                    flexShrink="0"
                    style={{ background: colors.background, color: colors.text }}
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text fontSize="xs" fontWeight="bold">
                      Aa
                    </Text>
                    <Box boxSize="3" rounded="full" style={{ background: colors.button }} />
                  </HStack>
                  <Text fontSize="sm" fontWeight="medium" flex="1">
                    {l(SCHEME_LABELS[key])}
                  </Text>
                  <Switch.Root
                    size="sm"
                    colorPalette="brand"
                    checked={!own}
                    onCheckedChange={({ checked }) => setScheme(checked ? undefined : colors)}
                  >
                    <Switch.HiddenInput />
                    <Switch.Label fontSize="xs" color="fg.muted">
                      {t('schemeAutomatic')}
                    </Switch.Label>
                    <Switch.Control />
                  </Switch.Root>
                </HStack>
                {own && (
                  <Stack gap="2" mt="3">
                    <ColorInput
                      label={t('schemeBackground')}
                      value={own.background}
                      onChange={(background) => setScheme({ ...own, background })}
                    />
                    <ColorInput
                      label={t('schemeText')}
                      value={own.text}
                      onChange={(text) => setScheme({ ...own, text })}
                    />
                    <ColorInput
                      label={t('schemeButton')}
                      value={own.button}
                      onChange={(button) => setScheme({ ...own, button })}
                    />
                    {invalid && (
                      <Alert.Root status="warning" size="sm">
                        <Alert.Indicator />
                        <Alert.Description>{t('schemeContrast')}</Alert.Description>
                      </Alert.Root>
                    )}
                  </Stack>
                )}
              </Box>
            )
          })}
        </ThemeSection>

        <ThemeSection value="motion" title={t('motion')}>
          <Labeled label={t('animation')} help={t('animationHelp')}>
            <ChoiceCards
              label={t('animation')}
              columns={3}
              value={settings.animation}
              onChange={(animation) => onChange({ ...settings, animation })}
              choices={ANIMATION_STYLES.map((value) => ({
                value,
                label: shortLabel(l(ANIMATION_LABELS[value])),
                hint: l(ANIMATION_LABELS[value]),
                preview: <Icon as={ANIMATION_GLYPHS[value]} boxSize="6" />,
              }))}
            />
          </Labeled>
        </ThemeSection>

        <ThemeSection value="splash" title={t('splash')} helper={t('splashHelp')}>
          {splashToggle(t('splashEnable'), 'enabled')}
          <Labeled label={t('splashStyle')} inline>
            <SelectInput
              value={settings.splash.style}
              options={SPLASH_STYLES.map((value) => ({
                value,
                label: l(SPLASH_STYLE_LABELS[value]),
              }))}
              onChange={(style) =>
                onChange({
                  ...settings,
                  splash: { ...settings.splash, style: style as SplashStyle },
                })
              }
            />
          </Labeled>
          <Labeled label={t('splashTone')}>
            <ChoiceCards
              label={t('splashTone')}
              columns={3}
              value={settings.splash.tone}
              onChange={(tone: SplashTone) =>
                onChange({ ...settings, splash: { ...settings.splash, tone } })
              }
              choices={SPLASH_TONES.map((value) => ({
                value,
                label: l(SPLASH_TONE_LABELS[value]),
                preview: (
                  <Box
                    boxSize="8"
                    rounded="full"
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    style={{
                      background:
                        value === 'page'
                          ? settings.colors.background
                          : value === 'brand'
                            ? settings.colors.brand
                            : '#1c1917',
                    }}
                  />
                ),
              }))}
            />
          </Labeled>
          {splashToggle(t('splashShowLogo'), 'showLogo')}
          {splashToggle(t('splashShowName'), 'showName')}
          {splashToggle(t('splashOncePerSession'), 'oncePerSession')}
          {shop && (
            <Button
              size="xs"
              variant="outline"
              alignSelf="start"
              onClick={() => setSplashPreview((count) => count + 1)}
            >
              {t('previewIntro')}
            </Button>
          )}
        </ThemeSection>

        <ThemeSection value="popup" title={t('popup')} helper={t('popupHelp')}>
          <Labeled label={t('popupKind')} inline>
            <SelectInput
              value={settings.popup.kind}
              options={POPUP_KINDS.map((value) => ({
                value,
                label: l(POPUP_KIND_LABELS[value]),
              }))}
              onChange={(kind) =>
                onChange({ ...settings, popup: { ...settings.popup, kind: kind as PopupKind } })
              }
            />
          </Labeled>
          {settings.popup.kind !== 'none' && (
            <>
              <Labeled label={t('popupTitle')}>
                <Input
                  size="sm"
                  value={settings.popup.title}
                  maxLength={120}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      popup: { ...settings.popup, title: event.currentTarget.value },
                    })
                  }
                />
              </Labeled>
              <Labeled label={t('popupBody')}>
                <Textarea
                  size="sm"
                  rows={3}
                  value={settings.popup.body}
                  maxLength={400}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      popup: { ...settings.popup, body: event.currentTarget.value },
                    })
                  }
                />
              </Labeled>
              <Labeled label={t('popupButton')}>
                <Input
                  size="sm"
                  value={settings.popup.buttonLabel}
                  maxLength={40}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      popup: { ...settings.popup, buttonLabel: event.currentTarget.value },
                    })
                  }
                />
              </Labeled>
              {(settings.popup.kind === 'welcome' || settings.popup.kind === 'exit') && (
                <Labeled label={t('popupDelay')} help={t('popupDelayHelp')}>
                  <Input
                    size="sm"
                    type="number"
                    min={1}
                    max={60}
                    value={settings.popup.delaySeconds}
                    onChange={(event) =>
                      onChange({
                        ...settings,
                        popup: {
                          ...settings.popup,
                          delaySeconds: Number(event.currentTarget.value) || 4,
                        },
                      })
                    }
                  />
                </Labeled>
              )}
              <HStack justify="space-between" w="full" align="flex-start" gap="4">
                <Text fontSize="sm">{t('popupOnce')}</Text>
                <Switch.Root
                  size="sm"
                  colorPalette="brand"
                  checked={settings.popup.oncePerSession}
                  onCheckedChange={({ checked }) =>
                    onChange({
                      ...settings,
                      popup: { ...settings.popup, oncePerSession: checked },
                    })
                  }
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                </Switch.Root>
              </HStack>
              <Button
                size="xs"
                variant="outline"
                alignSelf="start"
                onClick={() => setPopupPreview((count) => count + 1)}
              >
                {t('previewPopup')}
              </Button>
            </>
          )}
        </ThemeSection>

        <ThemeSection value="typography" title={t('typography')}>
          <Labeled label={t('headingFont')}>
            <FontSelect
              value={settings.fonts.heading}
              onChange={(heading) =>
                onChange({
                  ...settings,
                  fonts: { ...settings.fonts, heading: heading as FontFamily },
                })
              }
            />
          </Labeled>
          <Labeled label={t('bodyFont')}>
            <FontSelect
              value={settings.fonts.body}
              onChange={(body) =>
                onChange({ ...settings, fonts: { ...settings.fonts, body: body as FontFamily } })
              }
            />
          </Labeled>
        </ThemeSection>

        <ThemeSection value="shape" title={t('shape')}>
          <Labeled label={t('radius')}>
            <ChoiceCards
              label={t('radius')}
              columns={4}
              value={settings.radius}
              onChange={(radius) => onChange({ ...settings, radius })}
              choices={RADIUS_OPTIONS.map((value) => ({
                value,
                label: l(OPTION_LABELS[value]),
                preview: <RadiusPreview radius={value} />,
              }))}
            />
          </Labeled>
          <Labeled label={t('buttonStyle')}>
            <ChoiceCards
              label={t('buttonStyle')}
              columns={4}
              value={settings.buttonStyle}
              onChange={(buttonStyle) => onChange({ ...settings, buttonStyle })}
              choices={BUTTON_STYLES.map((value) => ({
                value,
                label: l(OPTION_LABELS[value]),
                preview: <ButtonPreview style={value} />,
              }))}
            />
          </Labeled>
          <Labeled label={t('cardStyle')}>
            <ChoiceCards
              label={t('cardStyle')}
              columns={4}
              value={settings.cardStyle}
              onChange={(cardStyle) => onChange({ ...settings, cardStyle })}
              choices={CARD_STYLES.map((value) => ({
                value,
                label: l(OPTION_LABELS[value]),
                preview: <CardPreview style={value} />,
              }))}
            />
          </Labeled>
          <Labeled label={t('cardHover')} help={t('cardHoverHelp')}>
            <ToggleCards
              label={t('cardHover')}
              columns={3}
              values={settings.cardHover}
              onChange={(cardHover) => onChange({ ...settings, cardHover })}
              choices={CARD_HOVER_EFFECTS.map((effect) => ({
                value: effect,
                label: shortLabel(l(CARD_HOVER_LABELS[effect])),
                hint: l(CARD_HOVER_LABELS[effect]),
                preview: <Icon as={HOVER_GLYPHS[effect]} boxSize="5" />,
              }))}
            />
          </Labeled>

          <Stack gap="1" pt="1">
            <Switch.Root
              size="sm"
              colorPalette="brand"
              w="full"
              justifyContent="space-between"
              checked={settings.productImageHover}
              onCheckedChange={({ checked }) =>
                onChange({ ...settings, productImageHover: checked })
              }
            >
              <Switch.HiddenInput />
              <Switch.Label fontSize="sm" fontWeight="normal">
                {t('productImageHover')}
              </Switch.Label>
              <Switch.Control />
            </Switch.Root>
            <Text textStyle="xs" color="fg.muted">
              {t('productImageHoverHelp')}
            </Text>
          </Stack>
        </ThemeSection>

        <ThemeSection value="size" title={t('size')}>
          <Labeled label={t('typeScale')} help={t('typeScaleHelp')}>
            <ChoiceCards
              label={t('typeScale')}
              columns={3}
              value={settings.typeScale}
              onChange={(typeScale) => onChange({ ...settings, typeScale })}
              choices={TYPE_SCALES.map((value) => ({
                value,
                label: l(TYPE_SCALE_LABELS[value]),
                preview: (
                  <Text as="span" fontSize={TYPE_SIZE[value]} fontWeight="semibold" lineHeight="1">
                    Aa
                  </Text>
                ),
              }))}
            />
          </Labeled>
          <Labeled label={t('density')} help={t('densityHelp')}>
            <ChoiceCards
              label={t('density')}
              columns={3}
              value={settings.density}
              onChange={(density) => onChange({ ...settings, density })}
              choices={DENSITIES.map((value) => ({
                value,
                label: l(DENSITY_LABELS[value]),
                preview: <DensityPreview density={value} />,
              }))}
            />
          </Labeled>
          <Labeled label={t('pageWidth')} help={t('pageWidthHelp')}>
            <ChoiceCards
              label={t('pageWidth')}
              columns={3}
              value={settings.pageWidth}
              onChange={(pageWidth) => onChange({ ...settings, pageWidth })}
              choices={PAGE_WIDTHS.map((value) => ({
                value,
                label: l(PAGE_WIDTH_LABELS[value]),
                preview: <PageWidthPreview width={value} />,
              }))}
            />
          </Labeled>
        </ThemeSection>

        {/* Only where the panel was handed the sections: translating needs them. */}
        {sections && onSectionsChange && (
          <ThemeSection
            value="localization"
            title={t('localization')}
            helper={t('localizationHelp')}
          >
            <Button
              size="xs"
              variant="outline"
              alignSelf="start"
              onClick={() => setTranslationOpen(true)}
            >
              {t('manageTranslation')}
            </Button>
          </ThemeSection>
        )}
      </Accordion.Root>

      {shop && splashPreview > 0 && (
        <Portal>
          <SplashScreen
            key={splashPreview}
            settings={settings}
            shop={shop}
            replay
            onDone={() => setSplashPreview(0)}
          />
        </Portal>
      )}

      {popupPreview > 0 && (
        <Portal>
          <SitePopup
            key={popupPreview}
            settings={settings}
            replay
            onDone={() => setPopupPreview(0)}
          />
        </Portal>
      )}

      {sections && onSectionsChange && (
        <TranslationManagerDialog
          open={translationOpen}
          onOpenChange={setTranslationOpen}
          sections={sections}
          onSectionsChange={onSectionsChange}
          sourceLocale={defaultLocale}
          onTranslate={onTranslate}
        />
      )}
    </Stack>
  )
}
