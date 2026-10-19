/** The video and parallax banners — the hero's moving relatives. */

import { Box } from '@chakra-ui/react'
import { useRef } from 'react'

import { Image } from '@repo/theme'

import { readText, readVideo } from '../model/fields'
import { readToken } from '../model/element-style'
import { PHOTO_FIT_VALUES, PHOTO_POSITION_VALUES } from '../model/section-style'
import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { useSectionLayout } from './frame'
import { BackgroundVideo } from './media'
import { useMotionEffect } from './motion/engine'
import { EmptyNotice } from './primitives'
import { BannerCopy, heroHeight, type SectionProps } from './sections'

export function BannerVideo({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { width } = useSectionLayout()
  const text = useRenderText()
  const video = readVideo(settings, 'video')
  const posterId = readText(settings, 'poster')
  const poster = posterId ? imageUrl(posterId, { width: 1920, height: 1080 }) : null
  const fit = readToken(settings, 'fit', PHOTO_FIT_VALUES, 'cover')
  const position = readToken(settings, 'position', PHOTO_POSITION_VALUES, 'center')

  if (!video && !poster) return <EmptyNotice>{text('pickVideo')}</EmptyNotice>

  return (
    <Box
      position="relative"
      rounded={width === 'edge' ? 'none' : 'l3'}
      overflow="hidden"
      minH={heroHeight(settings)}
      bg="gray.900"
    >
      <BackgroundVideo video={video} poster={poster} objectFit={fit} objectPosition={position} />
      <BannerCopy settings={settings} onImage withBody />
    </Box>
  )
}

/** How far, as a share of the scroll, the image lags behind the page. */
const PARALLAX = { soft: 0.18, strong: 0.35 } as const

/**
 * An image that scrolls slower than the page: a ScrollTrigger scrub moves it
 * ±half the intensity across the banner, with the zoom it starts at constant
 * underneath. Never through React state, which would re-render the section
 * sixty times a second. A shopper who prefers less motion sees a still
 * image; so does a page without JavaScript.
 */
export function BannerParallax({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { width } = useSectionLayout()
  const frame = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1920, height: 1280 }) : null
  const intensity =
    PARALLAX[readText(settings, 'intensity') as keyof typeof PARALLAX] ?? PARALLAX.soft

  useMotionEffect(
    frame,
    ({ gsap }) => {
      const element = frame.current
      const image = layer.current
      if (!element || !image) return
      gsap.set(image, { scale: 1 + intensity })
      gsap.fromTo(
        image,
        { yPercent: -50 * intensity },
        {
          yPercent: 50 * intensity,
          ease: 'none',
          scrollTrigger: {
            trigger: element,
            scroller: element.ownerDocument.documentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
    },
    [intensity],
  )

  return (
    <Box
      ref={frame}
      position="relative"
      rounded={width === 'edge' ? 'none' : 'l3'}
      overflow="hidden"
      minH={heroHeight(settings)}
      bg="gray.800"
    >
      {src && (
        <Box ref={layer} data-parallax="layer" position="absolute" inset="0" willChange="transform">
          <Image
            src={src}
            alt=""
            w="full"
            h="full"
            objectFit={readToken(settings, 'fit', PHOTO_FIT_VALUES, 'cover')}
            objectPosition={readToken(settings, 'position', PHOTO_POSITION_VALUES, 'center')}
            loading="lazy"
          />
        </Box>
      )}
      <BannerCopy settings={settings} onImage={Boolean(src)} />
    </Box>
  )
}
