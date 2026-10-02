/**
 * The splash screen: the brand intro a shop shows on a visit's first load.
 *
 * Theme chrome, not a section — it renders above the header on every
 * template while enabled, and never on in-site navigation (the storefront
 * shell does not remount between client-side navigations). It is off by
 * default, skips itself under `prefers-reduced-motion`, and dismisses on any
 * click. A page without JavaScript still opens: the exit is a pure CSS
 * animation, so the overlay hides itself even when no bundle arrives.
 *
 * The editor never plays it on load; the Theme tab's replay button renders
 * the same component with `replay`, so what the seller previews is what a
 * shopper sees. Snapshots draw their own document and never mount it.
 */

import { Flex, Heading } from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ImageWithFallback } from '@repo/theme'

import {
  resolveScheme,
  schemeCssVars,
  type SplashStyle,
  type ThemeSettings,
} from '../model/settings'
import { schemeCss } from './frame'

/** The intro holds this long, then the exit runs; the overlay leaves the DOM after this. */
const HOLD_MS = 1500
const TOTAL_MS = 2300
const SESSION_KEY = 'pb-splash'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The exit, as keyframes rather than a transition, so it runs without
 * JavaScript too. Each ends hidden and non-interactive.
 */
const EXITS: Record<SplashStyle, Record<string, unknown>> = {
  fade: {
    animation: `pb-splash-fade 620ms ease ${HOLD_MS}ms both`,
    '@keyframes pb-splash-fade': {
      to: { opacity: 0, visibility: 'hidden', pointerEvents: 'none' },
    },
  },
  'slide-up': {
    animation: `pb-splash-up 680ms cubic-bezier(0.22, 1, 0.36, 1) ${HOLD_MS}ms both`,
    '@keyframes pb-splash-up': {
      to: { transform: 'translateY(-102%)', visibility: 'hidden', pointerEvents: 'none' },
    },
  },
  'slide-down': {
    animation: `pb-splash-down 680ms cubic-bezier(0.22, 1, 0.36, 1) ${HOLD_MS}ms both`,
    '@keyframes pb-splash-down': {
      to: { transform: 'translateY(102%)', visibility: 'hidden', pointerEvents: 'none' },
    },
  },
  smoke: {
    animation: `pb-splash-smoke 900ms ease ${HOLD_MS}ms both`,
    '@keyframes pb-splash-smoke': {
      to: {
        opacity: 0,
        filter: 'blur(24px)',
        transform: 'scale(1.05)',
        visibility: 'hidden',
        pointerEvents: 'none',
      },
    },
  },
  ink: {
    animation: `pb-splash-ink 800ms ease ${HOLD_MS}ms both`,
    '@keyframes pb-splash-ink': {
      from: { clipPath: 'circle(150% at 50% 50%)' },
      to: {
        clipPath: 'circle(0% at 50% 50%)',
        visibility: 'hidden',
        pointerEvents: 'none',
      },
    },
  },
}

export interface SplashShop {
  name: string
  logoUrl: string | null
}

export function SplashScreen({
  settings,
  shop,
  replay = false,
  onDone,
}: {
  settings: ThemeSettings
  shop: SplashShop
  /** The editor's replay: plays regardless of enable and session state. */
  replay?: boolean
  onDone?: () => void
}) {
  const splash = settings.splash
  const [done, setDone] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useIsoLayoutEffect(() => {
    if (!splash.enabled && !replay) return
    const view = globalThis.window
    if (!view) return
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true)
      onDoneRef.current?.()
      return
    }
    if (!replay && splash.oncePerSession) {
      try {
        if (view.sessionStorage.getItem(SESSION_KEY) === '1') {
          setDone(true)
          onDoneRef.current?.()
          return
        }
        view.sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Private mode or storage disabled: play it.
      }
    }
    const timer = view.setTimeout(() => {
      setDone(true)
      onDoneRef.current?.()
    }, TOTAL_MS)
    return () => view.clearTimeout(timer)
  }, [splash.enabled, splash.oncePerSession, replay])

  if (done || (!splash.enabled && !replay)) return null

  const scheme =
    splash.tone === 'page'
      ? null
      : {
          key: splash.tone === 'dark' ? ('inverse' as const) : ('brand' as const),
        }
  const vars = scheme ? schemeCssVars(resolveScheme(settings, scheme.key)) : null

  return (
    <Flex
      data-splash=""
      aria-hidden
      position="fixed"
      inset="0"
      zIndex="2000"
      align="center"
      justify="center"
      direction="column"
      gap="4"
      px="6"
      bg="bg"
      color="fg"
      cursor="pointer"
      onClick={() => {
        setDone(true)
        onDoneRef.current?.()
      }}
      css={{
        ...(scheme && vars ? (schemeCss(scheme.key, vars) as Record<string, unknown>) : {}),
        ...EXITS[splash.style],
        // A page with no JavaScript must not stare at a logo: the same
        // keyframes hide it, and reduced motion never shows it at all.
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', display: 'none' },
      }}
    >
      {splash.showLogo && shop.logoUrl && (
        <ImageWithFallback
          src={shop.logoUrl}
          alt=""
          maxH="20"
          maxW="52"
          objectFit="contain"
          loading="eager"
        />
      )}
      {splash.showName && (
        <Heading
          as="div"
          size={{ base: '2xl', md: '4xl' }}
          fontFamily="heading"
          letterSpacing="-0.02em"
        >
          {shop.name}
        </Heading>
      )}
    </Flex>
  )
}
