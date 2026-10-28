import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import {
  checkboxSlotRecipe,
  datePickerSlotRecipe,
  emptyStateSlotRecipe,
  fieldSlotRecipe,
  fieldsetSlotRecipe,
  progressSlotRecipe,
  sliderSlotRecipe,
  switchSlotRecipe,
} from '@chakra-ui/react/theme'

/**
 * The shared Chakra system for every app in the monorepo.
 *
 * An editorial voice: Fraunces carries headings, display sizes and the brand
 * wordmark, Plus Jakarta Sans carries body and UI copy. The serif does its
 * work at large sizes with tight tracking and mid weights; body text stays a
 * highly legible sans with a roomier line height.
 */

/** Brand ramp - Zapier Orange */
const BRAND = {
  50: '#fff3e0',
  100: '#ffe0b2',
  200: '#ffcc80',
  300: '#ffb74d',
  400: '#ffa726',
  500: '#ff4f00',
  600: '#f57c00',
  700: '#ef6c00',
  800: '#e65100',
  900: '#bf360c',
  950: '#a32a00',
}

/** Surface ramp - Warm Cream to Coffee Ink */
const SURFACE = {
  50: '#fffefb', // Canvas
  100: '#f8f4f0', // Canvas Soft
  200: '#c5c0b1', // Mute
  300: '#939084', // Body Mid
  400: '#605d52', // Body
  500: '#36342e', // Ink Mid
  600: '#2f2a26', // Ink Soft
  700: '#201515', // Ink
  800: '#1c1212',
  900: '#140c0c',
  950: '#000000',
}

const ramp = (shades: Record<string, string>) =>
  Object.fromEntries(Object.entries(shades).map(([shade, value]) => [shade, { value }]))

const config = defineConfig({
  theme: {
    breakpoints: {
      xs: '35rem',
      sm: '40rem',
      md: '48rem',
      lg: '64rem',
      xl: '80rem',
      '2xl': '96rem',
    },

    tokens: {
      colors: {
        brand: ramp(BRAND),
        surface: ramp(SURFACE),

        ink: { value: '#201515' },
        canvas: { value: '#fffefb' },
        hairline: { value: '#201515' },

        /** The signature story surfaces. */
        block: {
          lime: { value: '#dceeb1' },
          lilac: { value: '#c5b0f4' },
          cream: { value: '#f4ecd6' },
          pink: { value: '#efd4d4' },
          mint: { value: '#c8e6cd' },
          coral: { value: '#f3c9b6' },
          navy: { value: '#1f1d3d' },
        },

        accent: { magenta: { value: '#ff3d8b' } },

        /**
         * The status ramps carry two ends, not one.
         *
         * The `100`/`500`–`700` end is for light mode: a pale tint to sit on,
         * a mid tone to write in. The `300`/`800`/`900` end is the dark-mode
         * mirror of it — a tinted near-black to sit on, a light tone to write
         * in — because a palette that only reaches down to `700` leaves dark
         * mode borrowing a neutral surface, and a status badge on a warm brown
         * that has nothing to do with its meaning is how a settled purchase
         * ended up reading as green text on mud.
         *
         * The dark surfaces keep a trace of the theme's warmth rather than
         * being pure hue, so a success panel still belongs to this app and not
         * to a generic green one.
         */
        success: {
          100: { value: '#e4f5e9' },
          300: { value: '#63d68a' },
          500: { value: '#1ea64a' },
          600: { value: '#17853b' },
          700: { value: '#12692f' },
          800: { value: '#1c3d2a' },
          900: { value: '#12251a' },
        },
        warning: {
          100: { value: '#f4ecd6' },
          300: { value: '#e8b45c' },
          500: { value: '#d38b1a' },
          600: { value: '#b57314' },
          700: { value: '#8f5a10' },
          800: { value: '#453317' },
          900: { value: '#2a2013' },
        },
        danger: {
          100: { value: '#fde7e4' },
          300: { value: '#f2897f' },
          400: { value: '#f0655a' },
          500: { value: '#e04236' },
          600: { value: '#d92d20' },
          700: { value: '#b42318' },
          800: { value: '#4a221e' },
          900: { value: '#2c1614' },
        },
      },

      fonts: {
        heading: {
          value: "'Fraunces', Georgia, 'Times New Roman', serif",
        },
        body: {
          value: "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
        },
        mono: {
          value:
            "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        },
        /**
         * The brand display face, shared with headings.
         *
         * The wordmark, display sizes and headlines all speak Fraunces, so the
         * brand reads as one voice. See the wordmark text style in
         * `./brand.tsx`. Fraunces loads as a variable face through
         * `FONT_LINKS` in `./fonts.ts`, with Georgia as the offline fallback.
         */
        brand: {
          value: "'Fraunces', Georgia, 'Times New Roman', serif",
        },
      },

      fontWeights: {
        light: { value: '300' },
        normal: { value: '400' },
        medium: { value: '500' },
        semibold: { value: '600' },
        bold: { value: '700' },
      },

      radii: {
        xs: { value: '2px' },
        sm: { value: '4px' },
        md: { value: '6px' },
        lg: { value: '8px' },
        xl: { value: '10px' },
        '2xl': { value: '12px' },
        '3xl': { value: '14px' },
        '4xl': { value: '16px' },
        pill: { value: '9999px' },
      },

      shadows: {
        soft: { value: '0 4px 16px rgb(0 0 0 / 0.06)' },
        modal: { value: '0 8px 24px rgb(0 0 0 / 0.12)' },
      },
    },

    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.900}' } },
          subtle: { value: { base: '{colors.surface.100}', _dark: '{colors.surface.800}' } },
          panel: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.800}' } },
          muted: { value: { base: '{colors.surface.200}', _dark: '{colors.surface.700}' } },
        },
        fg: {
          DEFAULT: { value: { base: '{colors.surface.700}', _dark: '{colors.surface.50}' } },
          muted: { value: { base: '{colors.surface.400}', _dark: '{colors.surface.200}' } },
          subtle: { value: { base: '{colors.surface.300}', _dark: '{colors.surface.300}' } },
          inverted: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.900}' } },
        },
        border: {
          DEFAULT: { value: { base: '{colors.surface.700}', _dark: '{colors.surface.500}' } },
          subtle: { value: { base: '{colors.surface.200}', _dark: '{colors.surface.600}' } },
        },

        brand: {
          solid: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.500}' } },
          contrast: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.50}' } },
          fg: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.500}' } },
          // An outline button's frame. Chakra's recipe reads `colorPalette.border`
          // (falling back to the pale `muted`); kept equal to `fg` so the frame
          // and the label are one colour.
          border: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.500}' } },
          muted: { value: { base: '{colors.brand.100}', _dark: '{colors.surface.600}' } },
          subtle: { value: { base: '{colors.brand.50}', _dark: '{colors.surface.700}' } },
          emphasized: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.600}' } },
          focusRing: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.500}' } },
        },

        /*
         * `fg`, `muted` and `subtle` are what Chakra's subtle variants paint a
         * whole alert or badge with — the surface and every word on it. In
         * dark mode they now come from the status ramp's own dark end rather
         * than from `surface`, so the tint under the text agrees with it.
         * `solid`, `contrast` and `emphasized` are unchanged: a solid success
         * button was already the right green.
         */
        success: {
          solid: { value: { base: '{colors.success.500}', _dark: '{colors.success.500}' } },
          contrast: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.700}' } },
          fg: { value: { base: '{colors.success.700}', _dark: '{colors.success.300}' } },
          muted: { value: { base: '{colors.success.100}', _dark: '{colors.success.800}' } },
          subtle: { value: { base: '{colors.success.100}', _dark: '{colors.success.900}' } },
          emphasized: { value: { base: '{colors.success.600}', _dark: '{colors.success.600}' } },
          focusRing: { value: { base: '{colors.success.500}', _dark: '{colors.success.500}' } },
        },
        warning: {
          solid: { value: { base: '{colors.warning.500}', _dark: '{colors.warning.500}' } },
          contrast: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.700}' } },
          fg: { value: { base: '{colors.warning.700}', _dark: '{colors.warning.300}' } },
          muted: { value: { base: '{colors.warning.100}', _dark: '{colors.warning.800}' } },
          subtle: { value: { base: '{colors.warning.100}', _dark: '{colors.warning.900}' } },
          emphasized: { value: { base: '{colors.warning.600}', _dark: '{colors.warning.600}' } },
          focusRing: { value: { base: '{colors.warning.500}', _dark: '{colors.warning.500}' } },
        },
        danger: {
          solid: { value: { base: '{colors.danger.500}', _dark: '{colors.danger.400}' } },
          contrast: { value: { base: '{colors.surface.50}', _dark: '{colors.surface.700}' } },
          fg: { value: { base: '{colors.danger.700}', _dark: '{colors.danger.300}' } },
          muted: { value: { base: '{colors.danger.100}', _dark: '{colors.danger.800}' } },
          subtle: { value: { base: '{colors.danger.100}', _dark: '{colors.danger.900}' } },
          emphasized: { value: { base: '{colors.danger.600}', _dark: '{colors.danger.500}' } },
          focusRing: { value: { base: '{colors.danger.500}', _dark: '{colors.danger.500}' } },
        },
      },

      radii: {
        l1: { value: '{radii.sm}' },
        l2: { value: '{radii.md}' },
        l3: { value: '{radii.lg}' },
      },
    },

    textStyles: {
      'display.xl': {
        value: {
          fontSize: 'clamp(3rem, 7.5vw, 5.375rem)',
          lineHeight: '1',
          fontWeight: '500',
          letterSpacing: '-0.02em',
        },
      },
      'display.lg': {
        value: {
          fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
          lineHeight: '1',
          fontWeight: '500',
          letterSpacing: '-0.02em',
        },
      },
      headline: {
        value: {
          fontSize: '1.5rem',
          lineHeight: '1.3',
          fontWeight: '500',
          letterSpacing: '-0.01em',
        },
      },
      eyebrow: {
        value: {
          fontFamily: 'body',
          fontSize: '0.875rem',
          lineHeight: '1',
          fontWeight: '600',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        },
      },
      caption: {
        value: {
          fontSize: '0.875rem',
          lineHeight: '1.5',
          fontWeight: '400',
          letterSpacing: 'normal',
        },
      },
      /**
       * The wordmark style: the brand serif at its native 400 weight.
       *
       * Prefer `<BrandWordmark>` over this token directly — the component is
       * what keeps every mark on the same element, weight, and wrapping.
       */
      'brand.wordmark': {
        value: {
          fontFamily: 'brand',
          fontWeight: '400',
          letterSpacing: '0',
        },
      },
    },

    recipes: {
      button: {
        base: {
          // A shop's published theme sets `--button-radius` (its corner size,
          // or a capsule), so every button on the storefront — not only the
          // ones that ask for the theme's look — takes the same shape. An
          // explicit `rounded` prop still wins: it lands in the utilities
          // layer, above recipes.
          borderRadius: 'var(--button-radius, var(--chakra-radii-md))',
          fontWeight: '600',
          letterSpacing: 'normal',
          textTransform: 'none',
        },
      },
    },

    slotRecipes: {
      /**
       * Centre every empty state's text. Chakra centres the block (icon, title,
       * description) but leaves the words themselves start-aligned, so on a
       * narrow screen a wrapped title and body hang off the left edge under a
       * centred icon.
       */
      emptyState: {
        ...emptyStateSlotRecipe,
        base: {
          ...emptyStateSlotRecipe.base,
          content: {
            ...emptyStateSlotRecipe.base?.content,
            textAlign: 'center',
          },
        },
      },
      /**
       * Helper and error text are block boxes, not inline-level ones.
       *
       * Chakra renders both as inline-level elements (a `span`, an
       * `inline-flex`), so when they sit inside a body-styled block the
       * parent's 1.6 line-height strut stretches every wrapped line to
       * ~26px — a three-line hint reads like double-spaced prose. A
       * block-level box uses its own `textStyle` line height instead, which
       * is what `FieldShell`'s `as="div"` helper already relied on. This
       * makes every usage, switch helpers included, match it.
       */
      field: {
        ...fieldSlotRecipe,
        base: {
          ...fieldSlotRecipe.base,
          helperText: { ...fieldSlotRecipe.base?.helperText, display: 'block' },
          errorText: { ...fieldSlotRecipe.base?.errorText, display: 'flex' },
        },
      },
      fieldset: {
        ...fieldsetSlotRecipe,
        base: {
          ...fieldsetSlotRecipe.base,
          helperText: { ...fieldsetSlotRecipe.base?.helperText, display: 'block' },
          errorText: { ...fieldsetSlotRecipe.base?.errorText, display: 'flex' },
        },
      },
      /**
       * Brand the checkbox. Chakra ticks it in the neutral palette — a black
       * box against this theme — so the root defaults to the brand palette,
       * which the control's checked fill and border read through. A
       * `colorPalette` prop on a usage still wins (utilities layer).
       */
      checkbox: {
        ...checkboxSlotRecipe,
        base: {
          ...checkboxSlotRecipe.base,
          root: {
            ...checkboxSlotRecipe.base?.root,
            colorPalette: 'brand',
          },
        },
      },
      /**
       * Brand the switch, for the same reason as the checkbox above: Chakra
       * paints the checked track with the neutral palette, so a "on" switch
       * reads as an unstyled black pill. The root's palette cascades to the
       * track and thumb; a `colorPalette` prop on a usage still wins.
       */
      switch: {
        ...switchSlotRecipe,
        base: {
          ...switchSlotRecipe.base,
          root: {
            ...switchSlotRecipe.base?.root,
            colorPalette: 'brand',
          },
        },
      },
      /**
       * Brand the progress bar, for the same reason as the checkbox, the switch
       * and the slider below: with no palette of its own Chakra fills the range
       * with the neutral ramp, so a progress bar reads as an unstyled black bar
       * rather than as a control of this theme. The root's palette cascades to
       * the track and the range; a `colorPalette` prop on a usage still wins.
       */
      progress: {
        ...progressSlotRecipe,
        base: {
          ...progressSlotRecipe.base,
          root: {
            ...progressSlotRecipe.base?.root,
            colorPalette: 'brand',
          },
        },
      },
      /**
       * Brand the slider, for the same reason as the checkbox and the switch
       * above: with no palette of its own Chakra paints the range and the
       * thumb with the neutral palette, so the timeline's zoom reads as a
       * black pin rather than as a control of this theme. The root's palette
       * cascades to the track, range and thumb; a `colorPalette` prop on a
       * usage still wins. The outline variant's track is repointed at the warm
       * `bg.muted` ramp — Chakra's `bg.emphasized` is a cool gray that belongs
       * to no surface in this system.
       */
      slider: {
        ...sliderSlotRecipe,
        base: {
          ...sliderSlotRecipe.base,
          root: {
            ...sliderSlotRecipe.base?.root,
            colorPalette: 'brand',
          },
        },
        variants: {
          ...sliderSlotRecipe.variants,
          variant: {
            ...sliderSlotRecipe.variants?.variant,
            outline: {
              ...sliderSlotRecipe.variants?.variant?.outline,
              track: {
                ...sliderSlotRecipe.variants?.variant?.outline?.track,
                bg: 'bg.muted',
              },
            },
          },
        },
      },
      /**
       * Brand the calendar. Chakra's default recipe paints the selected day,
       * the today marker, ranges and hovers with the neutral palette, which
       * reads as an unstyled black swatch against this theme. Only those
       * colour-bearing slots are repointed at the brand ramp above — sizes,
       * layout and motion stay exactly as Chakra ships them via the spreads
       * below — and every date picker in every app inherits this without a
       * per-usage prop.
       */
      datePicker: {
        ...datePickerSlotRecipe,
        base: {
          ...datePickerSlotRecipe.base,
          input: {
            ...datePickerSlotRecipe.base?.input,
            '--focus-color': 'colors.brand.focusRing',
          },
          prevTrigger: {
            ...datePickerSlotRecipe.base?.prevTrigger,
            _hover: { bg: 'brand.subtle' },
            _focusVisible: { boxShadow: '0 0 0 2px var(--colors-brand-focus-ring)' },
          },
          nextTrigger: {
            ...datePickerSlotRecipe.base?.nextTrigger,
            _hover: { bg: 'brand.subtle' },
            _focusVisible: { boxShadow: '0 0 0 2px var(--colors-brand-focus-ring)' },
          },
          viewTrigger: {
            ...datePickerSlotRecipe.base?.viewTrigger,
            _hover: { bg: 'brand.subtle' },
          },
          tableCellTrigger: {
            ...datePickerSlotRecipe.base?.tableCellTrigger,
            _hover: { bg: 'brand.subtle' },
            _today: {
              ...datePickerSlotRecipe.base?.tableCellTrigger?._today,
              color: 'brand.fg',
            },
            '&[data-selected]': {
              ...datePickerSlotRecipe.base?.tableCellTrigger?.['&[data-selected]'],
              bg: 'brand.solid',
              color: 'brand.contrast',
              _hover: { bg: 'brand.solid' },
            },
            '&[data-in-range]': {
              ...datePickerSlotRecipe.base?.tableCellTrigger?.['&[data-in-range]'],
              bg: 'brand.subtle',
              color: 'brand.fg',
              _hover: { bg: 'brand.subtle' },
            },
            '&[data-in-range][data-selected]': {
              ...datePickerSlotRecipe.base?.tableCellTrigger?.['&[data-in-range][data-selected]'],
              bg: 'brand.solid',
              color: 'brand.contrast',
              _hover: { bg: 'brand.solid' },
            },
          },
        },
      },
    },
  },

  globalCss: {
    html: {
      textSizeAdjust: '100%',
      scrollbarGutter: 'stable',
    },
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      fontFeatureSettings: "'kern', 'liga'",
      fontWeight: '400',
      lineHeight: '1.6',
      letterSpacing: 'normal',
    },
    /**
     * Stops iOS Safari zooming the page when a field takes focus.
     *
     * Safari zooms in on any focused form control whose font size is under
     * 16px, and does not zoom back out afterwards — so on a phone, tapping a
     * 14px input left the seller looking at a magnified, sideways-scrolling
     * page they then had to pinch their way out of. Every control in these apps
     * renders at `sm` or `md`, which is 14px.
     *
     * The alternative fix is `maximum-scale=1, user-scalable=no` on the
     * viewport meta, and it is the wrong one: it takes pinch-zoom away from
     * everybody, permanently, to work around a font size.
     *
     * `!important` is doing real work here rather than papering over a
     * specificity fight. Chakra declares `@layer reset, base, tokens, recipes`,
     * this block lands in `base`, and every field's size comes from a recipe —
     * so a normal declaration here loses to `recipes` no matter how specific it
     * is. An important one wins because `!important` reverses layer order.
     *
     * Scoped to `pointer: coarse` so only touch devices are affected; pointer
     * devices keep the typographic scale the components were designed with.
     */
    'input, select, textarea, [contenteditable]': {
      '@media (pointer: coarse)': {
        fontSize: '16px !important',
      },
    },
    '*:focus-visible': {
      outlineColor: 'brand.solid',
    },
    '::selection': {
      bg: 'brand.solid',
      color: 'canvas',
    },
  },
})

export const system = createSystem(defaultConfig, config)

/**
 * The raw ramps behind the `brand` / `surface` tokens, for non-Chakra use.
 *
 * The boot splash (`apps/admin/src/components/common/boot-splash.tsx`) is
 * plain HTML + inline CSS — it must paint before the Chakra system loads, so
 * it cannot read tokens through a hook or `useToken`. It interpolates these
 * values into its stylesheet instead, which keeps the theme file as the single
 * source of truth: re-ramping the brand repaints the splash with it.
 */
export const brandRamp: Record<number, string> = BRAND
export const surfaceRamp: Record<number, string> = SURFACE
