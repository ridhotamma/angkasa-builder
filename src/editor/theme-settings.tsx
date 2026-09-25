/** The theme tab: colours, fonts and shape, with the contrast check live. */

import { Alert, ColorPicker, HStack, parseColor, Portal, Stack, Text } from '@chakra-ui/react'
import { useMemo } from 'react'

import {
  BUTTON_STYLES,
  CARD_STYLES,
  contrastIssues,
  FONT_OPTIONS,
  OPTION_LABELS,
  RADIUS_OPTIONS,
  type FontFamily,
  type ThemeSettings,
} from '../model/settings'
import { Labeled, SelectInput } from './controls'
import { useEditorText, type EditorMessage } from './messages'

/**
 * Chakra's `ColorPicker`, in hex. Opaque only: theme colours have no alpha,
 * and `toString('hex')` keeps them in the `#rrggbb` shape the settings
 * sanitiser accepts.
 */
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const color = useMemo(() => parseColor(value), [value])

  return (
    <ColorPicker.Root
      size="sm"
      value={color}
      onValueChange={({ value: next }) => onChange(next.toString('hex').toLowerCase())}
    >
      <ColorPicker.HiddenInput />
      <ColorPicker.Label fontSize="sm">{label}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Input fontFamily="mono" />
        <ColorPicker.Trigger />
      </ColorPicker.Control>
      <Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.Area />
            <HStack>
              <ColorPicker.EyeDropper size="xs" variant="outline" />
              <ColorPicker.ChannelSlider channel="hue" flex="1" />
            </HStack>
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </Portal>
    </ColorPicker.Root>
  )
}

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
