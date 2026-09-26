/**
 * Video, drawn.
 *
 * A stored video is only ever a source and an id (`VideoRef`), so every URL
 * here is built from a validated id: an upload streams from the shop's video
 * bucket through `env.videoUrl`, and an embed can only ever point at YouTube's
 * privacy-enhanced player or Vimeo's. No stored value reaches a `src` as-is.
 */

import { AspectRatio, Box, chakra, IconButton, type BoxProps } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { LuPause, LuPlay, LuVolume2, LuVolumeX } from 'react-icons/lu'

import type { VideoRef } from '../model/fields'
import { useRenderEnvironment } from './context'
import { useInView, usePrefersReducedMotion } from './hooks'

/** The embed URL for an external video, from its id. */
export function embedUrl(
  video: VideoRef,
  options: { autoplay: boolean; background: boolean },
): string | null {
  const { autoplay, background } = options
  if (video.source === 'youtube') {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      ...(autoplay && { autoplay: '1', mute: '1' }),
      ...(background && { controls: '0', loop: '1', playlist: video.id }),
    })
    return `https://www.youtube-nocookie.com/embed/${video.id}?${params}`
  }
  if (video.source === 'vimeo') {
    const params = new URLSearchParams({
      dnt: '1',
      ...(autoplay && { autoplay: '1', muted: '1' }),
      ...(background && { background: '1', loop: '1' }),
    })
    return `https://player.vimeo.com/video/${video.id}?${params}`
  }
  return null
}

/**
 * An uploaded video that plays muted and looped while it is on screen and
 * pauses when it is not — so a page of reels does not run twelve decoders at
 * once. A shopper who prefers less motion gets the still cover and a play
 * button instead.
 */
export function AmbientVideo({
  fileId,
  poster,
  controls = false,
  objectFit = 'cover',
  ...props
}: {
  fileId: string
  poster: string | null
  controls?: boolean
  objectFit?: 'cover' | 'contain'
} & BoxProps) {
  const { videoUrl, mode } = useRenderEnvironment()
  const reduced = usePrefersReducedMotion()
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 })
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const src = videoUrl?.(fileId) ?? null

  useEffect(() => {
    const element = video.current
    if (!element) return
    if (inView && !reduced) {
      void element.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
    } else {
      element.pause()
      setPlaying(false)
    }
  }, [inView, reduced, src])

  return (
    <Box ref={ref} position="relative" overflow="hidden" {...props}>
      {src ? (
        <chakra.video
          ref={video}
          src={src}
          poster={poster ?? undefined}
          muted={muted}
          loop
          playsInline
          preload={mode === 'preview' ? 'metadata' : 'none'}
          controls={controls}
          w="full"
          h="full"
          objectFit={objectFit}
          display="block"
          // Muted autoplay on iOS needs the attribute, not just the property.
          {...{ 'webkit-playsinline': 'true' }}
        />
      ) : (
        poster && (
          <chakra.img src={poster} alt="" w="full" h="full" objectFit={objectFit} display="block" />
        )
      )}
      {src && !controls && (
        <Box position="absolute" bottom="3" right="3" display="flex" gap="2" zIndex="1">
          <IconButton
            aria-label={playing ? 'Pause' : 'Play'}
            size="xs"
            rounded="full"
            variant="subtle"
            bg="blackAlpha.600"
            color="white"
            _hover={{ bg: 'blackAlpha.700' }}
            onClick={(event) => {
              event.stopPropagation()
              const element = video.current
              if (!element) return
              if (element.paused) void element.play().then(() => setPlaying(true))
              else {
                element.pause()
                setPlaying(false)
              }
            }}
          >
            {playing ? <LuPause /> : <LuPlay />}
          </IconButton>
          <IconButton
            aria-label={muted ? 'Unmute' : 'Mute'}
            size="xs"
            rounded="full"
            variant="subtle"
            bg="blackAlpha.600"
            color="white"
            _hover={{ bg: 'blackAlpha.700' }}
            onClick={(event) => {
              event.stopPropagation()
              setMuted((value) => !value)
            }}
          >
            {muted ? <LuVolumeX /> : <LuVolume2 />}
          </IconButton>
        </Box>
      )}
    </Box>
  )
}

/**
 * A video from any source in a fixed shape: an upload with its own controls
 * (or ambient when `autoplay`), an embed in an iframe.
 */
export function VideoFrame({
  video,
  poster,
  ratio,
  autoplay,
  title,
}: {
  video: VideoRef
  poster: string | null
  ratio: number
  autoplay: boolean
  title: string
}) {
  const reduced = usePrefersReducedMotion()

  if (video.source === 'upload') {
    return (
      <AspectRatio ratio={ratio} rounded="l3" overflow="hidden" bg="black">
        {autoplay ? (
          <AmbientVideo fileId={video.id} poster={poster} />
        ) : (
          <UploadedVideo fileId={video.id} poster={poster} />
        )}
      </AspectRatio>
    )
  }

  const src = embedUrl(video, { autoplay: autoplay && !reduced, background: false })
  return (
    <AspectRatio ratio={ratio} rounded="l3" overflow="hidden" bg="black">
      {src ? (
        <chakra.iframe
          src={src}
          title={title || 'Video'}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          border="0"
        />
      ) : (
        <Box />
      )}
    </AspectRatio>
  )
}

function UploadedVideo({ fileId, poster }: { fileId: string; poster: string | null }) {
  const { videoUrl } = useRenderEnvironment()
  const src = videoUrl?.(fileId) ?? null
  if (!src) return <Box />
  return (
    <chakra.video
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      w="full"
      h="full"
      objectFit="contain"
    />
  )
}

/** Behind a banner's text: an upload, looped silently, or the cover when motion is unwelcome. */
export function BackgroundVideo({ video, poster }: { video: VideoRef | null; poster: string | null }) {
  const reduced = usePrefersReducedMotion()
  if (!video || video.source !== 'upload' || reduced) {
    return poster ? (
      <chakra.img src={poster} alt="" position="absolute" inset="0" w="full" h="full" objectFit="cover" />
    ) : null
  }
  return <AmbientVideo fileId={video.id} poster={poster} position="absolute" inset="0" />
}
