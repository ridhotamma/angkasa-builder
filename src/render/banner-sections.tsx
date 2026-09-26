/** The video and parallax banners — the hero's moving relatives. */

import { Box, Image } from '@chakra-ui/react'
import { useEffect, useRef } from 'react'

import { readText, readVideo } from '../model/fields'
import { useRenderEnvironment } from './context'
import { useRenderText } from './copy'
import { useSectionLayout } from './frame'
import { BackgroundVideo } from './media'
import { EmptyNotice } from './primitives'
import { BannerCopy, heroHeight, type SectionProps } from './sections'

export function VideoHero({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { width } = useSectionLayout()
  const text = useRenderText()
  const video = readVideo(settings, 'video')
  const posterId = readText(settings, 'poster')
  const poster = posterId ? imageUrl(posterId, { width: 1920, height: 1080 }) : null

  if (!video && !poster) return <EmptyNotice>{text('pickVideo')}</EmptyNotice>

  return (
    <Box
      position="relative"
      rounded={width === 'edge' ? 'none' : 'l3'}
      overflow="hidden"
      minH={heroHeight(settings)}
      bg="gray.900"
    >
      <BackgroundVideo video={video} poster={poster} />
      <BannerCopy settings={settings} onImage />
    </Box>
  )
}

/** How far, as a share of the scroll, the image lags behind the page. */
const PARALLAX = { soft: 0.18, strong: 0.35 } as const

/**
 * An image that scrolls slower than the page. Moved by a transform written
 * straight to the element on each animation frame — never through React
 * state, which would re-render the section sixty times a second — and only
 * while it is on screen. A shopper who prefers less motion sees a still
 * image; so does a page without JavaScript.
 */
export function ParallaxBanner({ settings }: SectionProps) {
  const { imageUrl } = useRenderEnvironment()
  const { width } = useSectionLayout()
  const frame = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const fileId = readText(settings, 'image')
  const src = fileId ? imageUrl(fileId, { width: 1920, height: 1280 }) : null
  const intensity = PARALLAX[readText(settings, 'intensity') as keyof typeof PARALLAX] ?? PARALLAX.soft

  useEffect(() => {
    const element = frame.current
    const image = layer.current
    const view = element?.ownerDocument.defaultView
    if (!element || !image || !view) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      const rect = element.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > view.innerHeight) return
      // -1 as the banner enters from below, +1 as it leaves at the top.
      const progress = (view.innerHeight / 2 - (rect.top + rect.height / 2)) / view.innerHeight
      image.style.transform = `translate3d(0, ${progress * intensity * rect.height}px, 0) scale(${1 + intensity})`
    }
    const onScroll = () => {
      if (!raf) raf = view.requestAnimationFrame(update)
    }
    update()
    view.addEventListener('scroll', onScroll, { passive: true })
    view.addEventListener('resize', onScroll)
    return () => {
      view.removeEventListener('scroll', onScroll)
      view.removeEventListener('resize', onScroll)
      if (raf) view.cancelAnimationFrame(raf)
    }
  }, [intensity])

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
        <Box ref={layer} position="absolute" inset="0" willChange="transform">
          <Image src={src} alt="" w="full" h="full" objectFit="cover" loading="lazy" />
        </Box>
      )}
      <BannerCopy settings={settings} onImage={Boolean(src)} />
    </Box>
  )
}
