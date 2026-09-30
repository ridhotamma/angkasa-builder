import { ChakraProvider } from '@chakra-ui/react'
import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'

import { createSection, DEFAULT_THEME_SETTINGS, sanitizeLayout, type SectionInstance, type ThemeLayout } from '../src'
import { PageBuilder } from '../src/editor'
import { sampleStorefrontData } from '../src/render'

const data = sampleStorefrontData('Kopi Kita')
const base = sanitizeLayout(null)
const services = { uploadImage: async () => '', imageUrl: () => null, collections: [], categories: [], pages: [] }
const formatPrice = (a: number) => `IDR ${a}`

function Lab() {
  const [sections, setSections] = useState<SectionInstance[]>(() => [
    createSection('hero', { heading: 'Feel the difference' }, { width: 'edge' }),
    ...['rich-text', 'faq', 'multicolumn', 'testimonials', 'image-with-text', 'rich-text', 'faq', 'contact-cta'].map((t) => createSection(t as any)),
  ])
  const [layout, setLayout] = useState<ThemeLayout>(() => ({ ...base, header: { ...base.header, sticky: true, transparentOnHome: true } }))
  return (
    <PageBuilder height="100dvh" sections={sections} onSectionsChange={setSections} scope="home"
      settings={DEFAULT_THEME_SETTINGS} layout={layout} onLayoutChange={setLayout}
      data={data} services={services} formatPrice={formatPrice} />
  )
}

createRoot(document.getElementById('root')!).render(
  <ChakraProvider value={system}>
    <I18nProvider locale={'id' as any} resources={{} as any}>
      <Lab />
    </I18nProvider>
  </ChakraProvider>,
)
