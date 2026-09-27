/** The theme tab: colours, fonts and shape, with the contrast check live. */

import { Alert, Box, HStack, Stack, Switch, Text } from '@chakra-ui/react'

import {
  ANIMATION_LABELS,
  ANIMATION_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  contrastIssues,
  FONT_OPTIONS,
  OPTION_LABELS,
  RADIUS_OPTIONS,
  resolveScheme,
  SCHEME_KEYS,
  SCHEME_LABELS,
  schemeContrastIssues,
  type FontFamily,
  type SchemeColors,
  type ThemeSettings,
} from '../model/settings'
import { ColorInput, Labeled, SelectInput } from './controls'
import { useEditorText, type EditorMessage } from './messages'

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
}: {
  settings: ThemeSettings
  onChange: (settings: ThemeSettings) => void
}) {
  const { t, l } = useEditorText()
  const issues = contrastIssues(settings)
  const schemeIssues = schemeContrastIssues(settings)

  const color = (key: keyof ThemeSettings['colors'], label: EditorMessage) => (
    <ColorInput
      label={t(label)}
      value={settings.colors[key]}
      onChange={(value) => onChange({ ...settings, colors: { ...settings.colors, [key]: value } })}
    />
  )

  const fontOptions = FONT_OPTIONS.map((font) => ({ value: font.family, label: font.family }))

  return (
    <Stack gap="6">
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
        <Heading>{t('typography')}</Heading>
        <Labeled label={t('headingFont')}>
          <SelectInput
            value={settings.fonts.heading}
            options={fontOptions}
            onChange={(heading) =>
              onChange({
                ...settings,
                fonts: { ...settings.fonts, heading: heading as FontFamily },
              })
            }
          />
        </Labeled>
        <Labeled label={t('bodyFont')}>
          <SelectInput
            value={settings.fonts.body}
            options={fontOptions}
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
    </Stack>
  )
}
