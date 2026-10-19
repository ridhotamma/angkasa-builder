import { AspectRatio, Box, Card, ChakraProvider, SimpleGrid, Text } from '@chakra-ui/react'
import { I18nProvider } from '@repo/i18n'
import { system } from '@repo/theme'
import { createRoot } from 'react-dom/client'
import { THEME_SEEDS } from '../src'
import { sampleStorefrontData, TemplateSnapshotPage } from '../src/render'
const data = sampleStorefrontData('Toko Testing')
createRoot(document.getElementById('root')!).render(
  <ChakraProvider value={system}>
    <I18nProvider locale={'en' as any} resources={{} as any}>
      <Box p="6" bg="bg.subtle">
        <SimpleGrid columns={2} gap="4" maxW="4xl">
          {THEME_SEEDS.map((seed) => (
            <Card.Root key={seed.slug} overflow="hidden">
              <AspectRatio ratio={16 / 10} bg="bg.muted" borderBottomWidth="1px">
                <TemplateSnapshotPage
                  content={seed.content()}
                  data={data}
                  imageUrl={() => null}
                  formatPrice={(a) => `IDR ${a}`}
                />
              </AspectRatio>
              <Card.Body>
                <Text fontWeight="semibold">{seed.name}</Text>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      </Box>
    </I18nProvider>
  </ChakraProvider>,
)
