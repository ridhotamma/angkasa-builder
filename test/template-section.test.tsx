import { describe, expect, test } from 'bun:test'
import { ChakraProvider } from '@chakra-ui/react'
import { createElement, Fragment, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'

import { DEFAULT_THEME_SETTINGS, type SectionInstance } from '../src/index'
import {
  compiledSectionComponent,
  RenderProvider,
  sampleStorefrontData,
  SectionsRenderer,
  themeSectionResolver,
  type RenderEnvironment,
} from '../src/render/index'
import { activateTheme, compileTheme, createTemplateRuntime, type TemplateH } from '../src/template'

const HERO = `<section data-compiled="hero"><p class="note">Free shipping</p><h1>{{ section.settings.heading }}</h1></section>{% schema %}{"name":"Template hero","settings":[{"key":"heading","kind":"text","max":80,"default":"Hello"}]}{% endschema %}`

function env(overrides: Partial<RenderEnvironment> = {}): RenderEnvironment {
  return {
    data: sampleStorefrontData('Compiled shop'),
    settings: DEFAULT_THEME_SETTINGS,
    mode: 'live',
    imageUrl: () => null,
    formatPrice: (amount, currency) => `${amount} ${currency}`,
    ...overrides,
  }
}

function activatedTheme() {
  const theme = compileTheme({
    'templates/index.tpl': `<p>home</p>`,
    'sections/template-hero.tpl': HERO,
  })
  const runtime = createTemplateRuntime(createElement as unknown as TemplateH, env(), Fragment)
  return activateTheme(theme, runtime)
}

function render(node: ReactNode): string {
  return renderToString(
    <ChakraProvider value={system}>
      <I18nProvider locale="en" resources={{}}>
        {node}
      </I18nProvider>
    </ChakraProvider>,
  )
}

/** A section type the shipped registry does not know: the compiled path. */
function compiledInstance(settings: Record<string, unknown> = {}): SectionInstance {
  return {
    id: 'sec-compiled',
    type: 'template-hero' as SectionInstance['type'],
    hidden: false,
    settings: { heading: 'Compiled heading', ...settings },
    style: {},
  }
}

describe('compiled sections in the renderer', () => {
  test('renders a compiled section inside the render provider', () => {
    const theme = activatedTheme()
    const Section = compiledSectionComponent(theme, 'template-hero')
    const html = render(
      <RenderProvider value={env()}>
        <Section settings={{ heading: 'From settings' }} />
      </RenderProvider>,
    )
    expect(html).toContain('data-compiled="hero"')
    expect(html).toContain('<h1>From settings</h1>')
    expect(html).toContain('Free shipping')
  })

  test('the registry falls back to the environment resolver for unknown types', () => {
    const theme = activatedTheme()
    const html = render(
      <SectionsRenderer
        sections={[compiledInstance()]}
        env={env({ sections: themeSectionResolver(theme) })}
      />,
    )
    expect(html).toContain('data-compiled="hero"')
    expect(html).toContain('Compiled heading')
  })

  test('a shipped type still renders through the shipped renderer', () => {
    const theme = activatedTheme()
    const shipped: SectionInstance = {
      id: 'sec-shipped',
      type: 'rich-text',
      hidden: false,
      settings: { heading: 'Shipped heading', body: 'Body copy', align: 'left', width: 'narrow' },
      style: {},
    }
    const html = render(
      <SectionsRenderer
        sections={[shipped]}
        env={env({ sections: themeSectionResolver(theme) })}
      />,
    )
    expect(html).toContain('Shipped heading')
    expect(html).not.toContain('data-compiled')
  })

  test('the resolver refuses types the theme does not define', () => {
    const theme = activatedTheme()
    const resolve = themeSectionResolver(theme)
    expect(resolve('template-hero')).not.toBeNull()
    expect(resolve('nope')).toBeNull()
    // Memoized: the same component identity, so React never remounts.
    expect(resolve('template-hero')).toBe(resolve('template-hero'))
  })
})
