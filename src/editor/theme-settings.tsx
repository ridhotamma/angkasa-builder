/** The theme tab: colours, fonts and shape, with the contrast check live. */

import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Portal,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { useState } from 'react'
import { LuSparkles } from 'react-icons/lu'

import {
  ANIMATION_LABELS,
  ANIMATION_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  contrastIssues,
  DENSITIES,
  DENSITY_LABELS,
  OPTION_LABELS,
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
import { SitePopup } from '../render/popup'
import { SplashScreen, type SplashShop } from '../render/splash'
import { ColorInput, Labeled, SelectInput } from './controls'
import { FontSelect } from './font-select'
import { LookPickerDialog } from './look-picker-dialog'
import { useEditorText, type EditorMessage } from './messages'
import { PaletteStrip } from './palette-swatch'

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

export function ThemeSettingsPanel({
  settings,
  onChange,
  shop,
  priorityLookKeys = [],
}: {
  settings: ThemeSettings
  onChange: (settings: ThemeSettings) => void
  /** The shop's own name and logo, for the splash replay. */
  shop?: SplashShop
  /** Look keys a freshly installed template suggests, shown first. */
  priorityLookKeys?: readonly string[]
}) {
  const { t, l } = useEditorText()
  // The picker opens only when the seller asks for it: a modal that opens
  // itself on a fresh theme or install is one more thing to dismiss, and
  // dismissing it could take the editor down with it.
  const [pickerOpen, setPickerOpen] = useState(false)
  // A count, so each press replays the intro; zero means it is not playing.
  const [splashPreview, setSplashPreview] = useState(0)
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

      <Stack gap="3">
        <Heading>{t('colors')}</Heading>
        {color('brand', 'brandColor')}
        {color('background', 'backgroundColor')}
        {color('text', 'textColor')}
        {color('accent', 'accentColor')}
        {issues.map((issue) => (
          <Alert.Root key={issue} status="warning" size="sm">
            <Alert.Indicator />
            <Alert.Description>
              {t(issue === 'text' ? 'contrastText' : 'contrastBrand')}
            </Alert.Description>
          </Alert.Root>
        ))}
      </Stack>

      <Stack gap="3">
        <Heading>{t('colorSchemes')}</Heading>
        <Text fontSize="xs" color="fg.muted">
          {t('colorSchemesHelp')}
        </Text>
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
      </Stack>

      <Stack gap="3">
        <Heading>{t('motion')}</Heading>
        <Labeled label={t('animation')} help={t('animationHelp')}>
          <SelectInput
            value={settings.animation}
            options={ANIMATION_STYLES.map((value) => ({
              value,
              label: l(ANIMATION_LABELS[value]),
            }))}
            onChange={(animation) =>
              onChange({ ...settings, animation: animation as ThemeSettings['animation'] })
            }
          />
        </Labeled>
      </Stack>

      <Stack gap="3">
        <Heading>{t('splash')}</Heading>
        <Text fontSize="xs" color="fg.muted">
          {t('splashHelp')}
        </Text>
        {splashToggle(t('splashEnable'), 'enabled')}
        <Labeled label={t('splashStyle')}>
          <SelectInput
            value={settings.splash.style}
            options={SPLASH_STYLES.map((value) => ({
              value,
              label: l(SPLASH_STYLE_LABELS[value]),
            }))}
            onChange={(style) =>
              onChange({ ...settings, splash: { ...settings.splash, style: style as SplashStyle } })
            }
          />
        </Labeled>
        <Labeled label={t('splashTone')}>
          <SelectInput
            value={settings.splash.tone}
            options={SPLASH_TONES.map((value) => ({
              value,
              label: l(SPLASH_TONE_LABELS[value]),
            }))}
            onChange={(tone) =>
              onChange({ ...settings, splash: { ...settings.splash, tone: tone as SplashTone } })
            }
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
      </Stack>

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

      <Stack gap="3">
        <Heading>{t('popup')}</Heading>
        <Text fontSize="xs" color="fg.muted">
          {t('popupHelp')}
        </Text>
        <Labeled label={t('popupKind')}>
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
      </Stack>

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

      <Stack gap="3">
        <Heading>{t('typography')}</Heading>
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
      </Stack>

      <Stack gap="3">
        <Heading>{t('shape')}</Heading>
        <Labeled label={t('radius')}>
          <SelectInput
            value={settings.radius}
            options={RADIUS_OPTIONS.map((value) => ({ value, label: l(OPTION_LABELS[value]) }))}
            onChange={(radius) =>
              onChange({ ...settings, radius: radius as ThemeSettings['radius'] })
            }
          />
        </Labeled>
        <Labeled label={t('buttonStyle')}>
          <SelectInput
            value={settings.buttonStyle}
            options={BUTTON_STYLES.map((value) => ({ value, label: l(OPTION_LABELS[value]) }))}
            onChange={(buttonStyle) =>
              onChange({ ...settings, buttonStyle: buttonStyle as ThemeSettings['buttonStyle'] })
            }
          />
        </Labeled>
        <Labeled label={t('cardStyle')}>
          <SelectInput
            value={settings.cardStyle}
            options={CARD_STYLES.map((value) => ({ value, label: l(OPTION_LABELS[value]) }))}
            onChange={(cardStyle) =>
              onChange({ ...settings, cardStyle: cardStyle as ThemeSettings['cardStyle'] })
            }
          />
        </Labeled>
      </Stack>

      <Stack gap="3">
        <Heading>{t('size')}</Heading>
        <Labeled label={t('typeScale')} help={t('typeScaleHelp')}>
          <SelectInput
            value={settings.typeScale}
            options={TYPE_SCALES.map((value) => ({ value, label: l(TYPE_SCALE_LABELS[value]) }))}
            onChange={(typeScale) =>
              onChange({ ...settings, typeScale: typeScale as ThemeSettings['typeScale'] })
            }
          />
        </Labeled>
        <Labeled label={t('density')} help={t('densityHelp')}>
          <SelectInput
            value={settings.density}
            options={DENSITIES.map((value) => ({ value, label: l(DENSITY_LABELS[value]) }))}
            onChange={(density) =>
              onChange({ ...settings, density: density as ThemeSettings['density'] })
            }
          />
        </Labeled>
      </Stack>
    </Stack>
  )
}
