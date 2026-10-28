'use client'

import {
  Box,
  Center,
  Icon,
  Image as ChakraImage,
  Link,
  type BoxProps,
  type ImageProps,
} from '@chakra-ui/react'
import { useState, type ElementType, type ReactNode } from 'react'
import { AiOutlineProduct } from 'react-icons/ai'

import {
  parseStockPhoto,
  stockPhotoCrossOrigin,
  type StockPhotoProvider,
} from '../model/stock-photo'

const STOCK_PROVIDER_LABELS: Record<StockPhotoProvider, string> = {
  pixabay: 'Pixabay',
  pexels: 'Pexels',
  unsplash: 'Unsplash',
}

export interface ImageWithFallbackProps extends ImageProps {
  /** Swapped in for the default product glyph when a surface wants its own. */
  fallbackIcon?: ElementType
  /** Replaces the whole placeholder, icon and ground both. */
  fallback?: ReactNode
  /** Size of the placeholder glyph, in theme space units. */
  fallbackIconSize?: BoxProps['boxSize']
}

/**
 * Chakra's `Image`, with one addition: a hotlinked stock photo is fetched
 * with `crossorigin="anonymous"`.
 *
 * The stock providers' CDNs (`cdn.pixabay.com`, `images.pexels.com`,
 * `images.unsplash.com`, `pixabay.com/get/`) answer with third-party cookies
 * — Cloudflare's `__cf_bm`, Pexels' `_cfuvid` — on every hotlinked image.
 * Browsers are phasing third-party cookies out, and Lighthouse flags them in
 * Best Practices, so the request is made without credentials: the bytes load
 * the same (every provider allows anonymous CORS), nothing is sent, and
 * nothing is stored. Anonymous also lets React's server renderer emit the
 * matching `<link rel="preload">`, so the early fetch is reused instead of
 * doubled. Everything that is not a stock photo keeps the element's default.
 */
export function Image({ crossOrigin, ...props }: ImageProps) {
  return <ChakraImage crossOrigin={crossOrigin ?? stockPhotoCrossOrigin(props.src)} {...props} />
}

/**
 * An `<img>` that never leaves a hole in the layout.
 *
 * Two things put a hole there, and the call sites were only ever handling the
 * first: a record with no file at all (`src` is null, because the shop never
 * uploaded a banner), and a file that was uploaded but no longer loads — it was
 * deleted from the bucket, or the request failed. The second case is the one
 * that renders a browser's broken-image glyph, so the `onError` handler matters
 * as much as the falsy check.
 *
 * The placeholder is deliberately quiet: `bg.subtle` and a muted glyph, which
 * in dark mode is a shade off the panel rather than a light rectangle punched
 * into it. It fills its parent, so it drops into an `AspectRatio` exactly where
 * the image would have gone.
 *
 * A **stock photo** — a hotlinked Pixabay/Pexels/Unsplash URL the AI filled
 * in — also renders its photographer's credit, which the APIs require. The
 * credit rides in the URL fragment (`model/stock-photo`), so
 * no second field has to travel with the image. An image the caller positioned
 * itself (`position="absolute"`, a background layer) keeps its plain render:
 * there is no flow box to hang a caption on.
 */
export function ImageWithFallback({
  src,
  fallback,
  fallbackIcon = AiOutlineProduct,
  fallbackIconSize = '8',
  ...props
}: ImageWithFallbackProps) {
  // The failed URL, not a boolean: a card that swaps in a new `src` (a gallery
  // thumbnail, a re-uploaded logo) then gets a fresh attempt for free, with no
  // effect needed to clear the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      fallback ?? (
        <Center bg="bg.subtle" color="fg.subtle" w="full" h="full">
          <Icon as={fallbackIcon} boxSize={fallbackIconSize} />
        </Center>
      )
    )
  }

  const image = <Image src={src} onError={() => setFailedSrc(src)} {...props} />
  const credit = parseStockPhoto(src)
  if (!credit || props.position !== undefined) return image

  return (
    <Box position="relative" w="full" h="full">
      <Image src={src} onError={() => setFailedSrc(src)} w="full" h="full" {...props} />
      <Link
        href={credit.photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
        position="absolute"
        bottom="1"
        right="1"
        px="1.5"
        py="0.5"
        rounded="sm"
        bg="blackAlpha.600"
        color="white"
        fontSize="2xs"
        lineHeight="short"
        maxW="90%"
        truncate
        _hover={{ bg: 'blackAlpha.700' }}
      >
        {/* A photo with no photographer on record carries the provider's name
            in that slot; "Unsplash · Unsplash" says nothing twice. */}
        {credit.photographer === STOCK_PROVIDER_LABELS[credit.provider]
          ? credit.photographer
          : `${credit.photographer} · ${STOCK_PROVIDER_LABELS[credit.provider]}`}
      </Link>
    </Box>
  )
}
