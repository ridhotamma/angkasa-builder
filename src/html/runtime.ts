/**
 * The browser half of `angkasa-builder/html`: the page's interactive parts,
 * with no framework.
 *
 * `renderPageHtml` sends plain markup whose interactive parts carry hooks:
 * Chakra's own `data-scope` / `data-part` attributes on accordions, tabs,
 * dialogs, drawers and dropdowns, and `data-pb-*` on the parts the page builder
 * draws itself (sliders, the header, countdowns, popups). This module reads
 * them. It is plain DOM code, so it works under htmx, Turbo, Alpine or none:
 * clicks are handled by delegation on the document, and parts that keep time
 * (a slider's autoplay, a countdown) are set up when they enter the page and
 * torn down when they leave it — a swapped-in fragment works with no extra
 * call.
 *
 * Imports nothing that touches React: only the slider's arithmetic and the
 * header's variable names, shared with the React renderer so the two agree.
 */

import { HEADER_HEIGHT_VAR, HEADER_OFFSET_VAR } from '../render/chrome-vars'
import {
  AUTOPLAY_MS,
  DEFAULT_GAP,
  FLING_EASE,
  FLING_PROJECTION_MS,
  FLING_SAMPLE_MS,
  flingGlideMs,
  gestureTime,
  releaseVelocity,
  SLIDE_EASE,
  SLIDE_MS,
  SLIDE_SWIPE_PX,
  sliderBasis,
  sliderGeometry,
  sliderTransform,
  WRAP_FALLBACK_MS,
  type SliderGeometry,
} from '../render/slider-math'

type Cleanup = () => void

/** Parts that run on their own, keyed by their element; cleaned up once it leaves the page. */
const mounted = new Map<Element, Cleanup>()

/** Every document the runtime listens on, so a second start is a no-op. */
const started = new WeakSet<Document>()

/**
 * Start the runtime on a document: wire up what is already there, and watch
 * for anything added or removed later. Safe to call more than once.
 */
export function startPageRuntime(doc: Document = document): void {
  if (started.has(doc)) return
  started.add(doc)
  doc.addEventListener('click', onClick)
  doc.addEventListener('keydown', onKeyDown)
  doc.addEventListener('pointerover', onPointerOver)
  doc.addEventListener('pointerout', onPointerOut)
  doc.addEventListener('focusin', onFocusIn)
  mountPageRuntime(doc.documentElement)
  const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
    let removed = false
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) mountPageRuntime(node as Element)
      })
      if (record.removedNodes.length > 0) removed = true
    }
    if (removed) sweep()
  })
  observer.observe(doc.documentElement, { childList: true, subtree: true })
}

/**
 * Set up the self-running parts inside `root` (and `root` itself). The
 * document-level listeners need `startPageRuntime`; this is for a host that
 * inserts markup somewhere the observer cannot see, such as a shadow root.
 */
export function mountPageRuntime(root: Element): void {
  const each = (selector: string, mount: (element: HTMLElement) => Cleanup | void) => {
    const found = root.matches(selector)
      ? [root, ...root.querySelectorAll(selector)]
      : [...root.querySelectorAll(selector)]
    for (const element of found) {
      if (mounted.has(element)) continue
      const cleanup = mount(element as HTMLElement)
      mounted.set(element, cleanup ?? (() => {}))
    }
  }
  each('[data-pb-slider]', mountSlider)
  each('[data-pb-countdown]', mountCountdown)
  each('[data-pb-header]', mountHeader)
  each('[data-pb-announcements]', mountAnnouncements)
  each('[data-pb-popup]', mountPopup)
  each('[data-splash]', mountSplash)
}

/** Tear down every part whose element has left the page. */
function sweep() {
  for (const [element, cleanup] of mounted) {
    if (element.isConnected) continue
    mounted.delete(element)
    cleanup()
  }
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function viewOf(element: Element): Window & typeof globalThis {
  return (element.ownerDocument.defaultView ?? window) as Window & typeof globalThis
}

function reducedMotion(element: Element): boolean {
  return viewOf(element).matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Hide or show an element whose own CSS may set `display`. */
function setHidden(element: HTMLElement, hidden: boolean) {
  element.hidden = hidden
  element.style.display = hidden ? 'none' : ''
}

function readStorage(element: Element, key: string): string | null {
  try {
    return viewOf(element).sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(element: Element, key: string, value: string) {
  try {
    viewOf(element).sessionStorage.setItem(key, value)
  } catch {
    // Private mode: nothing to remember.
  }
}

/** After an element's exit animation, or a beat later if it has none. */
function afterAnimation(element: HTMLElement, done: () => void) {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    element.removeEventListener('animationend', finish)
    done()
  }
  const style = viewOf(element).getComputedStyle(element)
  const animated = style.animationName && style.animationName !== 'none'
  if (!animated) {
    finish()
    return
  }
  element.addEventListener('animationend', finish)
  viewOf(element).setTimeout(finish, 600)
}

/**
 * Where a lifted overlay came from, so it can go back. The markup keeps
 * overlays in place (there is no portal without React), but a header with a
 * backdrop blur or a transformed section would trap a `position: fixed`
 * child inside its own box. So an overlay moves to `<body>` while it is open
 * and returns when it closes — the page's own tree is unchanged between
 * uses, and a fragment swapped over it takes its overlays with it.
 */
const lifted = new Map<HTMLElement, { parent: Node; next: Node | null }>()

function lift(element: HTMLElement | null) {
  if (!element || lifted.has(element)) return
  const body = element.ownerDocument.body
  if (element.parentNode === body || !element.parentNode) return
  lifted.set(element, { parent: element.parentNode, next: element.nextSibling })
  body.appendChild(element)
}

function lower(element: HTMLElement | null) {
  const home = element ? lifted.get(element) : undefined
  if (!element || !home) return
  lifted.delete(element)
  if (!home.parent.isConnected) {
    // Its section was swapped out while it was open: it goes with it.
    element.remove()
    return
  }
  home.parent.insertBefore(
    element,
    home.next && home.next.parentNode === home.parent ? home.next : null,
  )
}

/**
 * The next frame — or a moment later, in a tab the browser is not painting,
 * where animation frames never come and a slider waiting on one would freeze.
 */
function nextFrame(view: Window, run: () => void) {
  let done = false
  const once = () => {
    if (done) return
    done = true
    run()
  }
  view.requestAnimationFrame(once)
  view.setTimeout(once, 50)
}

/**
 * `element.closest(selector)`, looking through a lifted overlay to where it
 * sits in the page — so a popup's button still finds its popup while the
 * dialog is open on `<body>`.
 */
function closestHome<T extends HTMLElement = HTMLElement>(
  element: Element,
  selector: string,
): T | null {
  let node: Element | null = element
  while (node) {
    const found = node.closest<T>(selector)
    if (found) return found
    // Climb to the topmost lifted ancestor and continue from its home.
    let top: Element | null = null
    for (const lifted_ of lifted.keys()) if (lifted_.contains(node)) top = lifted_
    const home = top ? lifted.get(top as HTMLElement)?.parent : null
    node = home && home.nodeType === 1 ? (home as Element) : null
  }
  return null
}

/** The element an Ark id points at, in the same document. */
function byId(from: Element, id: string | null): HTMLElement | null {
  return id ? from.ownerDocument.getElementById(id) : null
}

/* -------------------------------------------------------------------------- */
/* Delegated events                                                           */
/* -------------------------------------------------------------------------- */

function onClick(event: MouseEvent) {
  const target = event.target as Element | null
  if (!target?.closest) return

  const accordion = target.closest<HTMLElement>(
    '[data-scope="accordion"][data-part="item-trigger"]',
  )
  if (accordion) return toggleAccordion(accordion)

  const collapsible = target.closest<HTMLElement>('[data-scope="collapsible"][data-part="trigger"]')
  if (collapsible) return toggleCollapsible(collapsible)

  const tab = target.closest<HTMLElement>('[data-scope="tabs"][data-part="trigger"]')
  if (tab) return selectTab(tab)

  const copy = target.closest<HTMLElement>('[data-pb-copy]')
  if (copy) return copyCode(copy)

  const popupClose = target.closest<HTMLElement>('[data-pb-popup-close]')
  if (popupClose) return closePopup(popupClose)

  const splash = target.closest<HTMLElement>('[data-splash]')
  if (splash) return void splash.remove()

  const dialogTrigger = target.closest<HTMLElement>('[data-scope="dialog"][data-part="trigger"]')
  if (dialogTrigger) {
    const content = byId(dialogTrigger, dialogTrigger.getAttribute('aria-controls'))
    if (content) openDialog(content, dialogTrigger)
    return
  }

  const dialogClose = target.closest<HTMLElement>(
    '[data-scope="dialog"][data-part="close-trigger"]',
  )
  if (dialogClose) {
    const content = dialogClose.closest<HTMLElement>('[data-scope="dialog"][data-part="content"]')
    if (content) closeDialog(content)
    return
  }

  // A tap outside an open dialog's content — on the backdrop, or the
  // positioner around the content — dismisses it.
  const positioner = target.closest<HTMLElement>('[data-scope="dialog"][data-part="positioner"]')
  if (positioner && !target.closest('[data-scope="dialog"][data-part="content"]')) {
    const content = positioner.querySelector<HTMLElement>(
      '[data-scope="dialog"][data-part="content"]',
    )
    if (content && dismissable(content)) closeDialog(content)
    return
  }

  // A link inside the phone menu leaves the menu as well as the page.
  const link = target.closest<HTMLElement>('a[href]')
  const inDialog = link?.closest<HTMLElement>('[data-scope="dialog"][data-part="content"]')
  if (inDialog && inDialog.getAttribute('data-state') === 'open') closeDialog(inDialog)

  const popoverTrigger = target.closest<HTMLElement>('[data-scope="popover"][data-part="trigger"]')
  if (popoverTrigger) return togglePopover(popoverTrigger)
  // Anywhere else closes an open popover.
  if (!target.closest('[data-scope="popover"][data-part="content"]')) closeAllPopovers(target)
}

/** The document an event happened in, whether it fired on a node or the document itself. */
function documentOf(event: Event): Document {
  const target = event.target as Node | null
  if (target?.nodeType === 9) return target as Document
  return target?.ownerDocument ?? document
}

function onKeyDown(event: KeyboardEvent) {
  const doc = documentOf(event)
  if (event.key === 'Escape') {
    const open = topDialog(doc)
    if (open) {
      if (dismissable(open)) closeDialog(open)
      return
    }
    closeAllPopovers(doc.documentElement)
    return
  }
  if (event.key === 'Tab') trapFocus(event, doc)
}

/* -------------------------------------------------------------------------- */
/* Accordion and collapsible                                                  */
/* -------------------------------------------------------------------------- */

function setOpenState(elements: Array<HTMLElement | null>, open: boolean) {
  for (const element of elements) element?.setAttribute('data-state', open ? 'open' : 'closed')
}

/**
 * Show or hide a collapsing panel the way Ark does: the panel's measured size
 * goes in `--height` / `--width` for Chakra's expand and collapse keyframes,
 * and `hidden` only lands once the collapse has played.
 */
function revealPanel(content: HTMLElement, open: boolean) {
  if (open) {
    content.hidden = false
    content.style.setProperty('--height', `${content.scrollHeight}px`)
    content.style.setProperty('--width', `${content.scrollWidth}px`)
    content.setAttribute('data-state', 'open')
    return
  }
  content.style.setProperty('--height', `${content.scrollHeight}px`)
  content.setAttribute('data-state', 'closed')
  afterAnimation(content, () => {
    if (content.getAttribute('data-state') === 'closed') content.hidden = true
  })
}

function setAccordionItem(trigger: HTMLElement, open: boolean) {
  const item = trigger.closest<HTMLElement>('[data-scope="accordion"][data-part="item"]')
  const content = byId(trigger, trigger.getAttribute('aria-controls'))
  const indicator = item?.querySelector<HTMLElement>(
    ':scope > [data-part="item-trigger"] [data-part="item-indicator"]',
  )
  trigger.setAttribute('aria-expanded', String(open))
  setOpenState([item ?? null, trigger, indicator ?? null], open)
  if (content) revealPanel(content, open)
}

function toggleAccordion(trigger: HTMLElement) {
  if (trigger.closest('[data-pb-preview-lock]')) return
  const open = trigger.getAttribute('aria-expanded') !== 'true'
  const root = trigger.closest<HTMLElement>('[data-scope="accordion"][data-part="root"]')
  // One open at a time, unless the accordion was drawn with `multiple`.
  if (open && root && !root.hasAttribute('data-pb-multiple')) {
    for (const other of root.querySelectorAll<HTMLElement>('[data-part="item-trigger"]')) {
      if (other === trigger) continue
      if (other.closest('[data-scope="accordion"][data-part="root"]') !== root) continue
      if (other.getAttribute('aria-expanded') === 'true') setAccordionItem(other, false)
    }
  }
  setAccordionItem(trigger, open)
}

function toggleCollapsible(trigger: HTMLElement) {
  const root = trigger.closest<HTMLElement>('[data-scope="collapsible"][data-part="root"]')
  const content =
    byId(trigger, trigger.getAttribute('aria-controls')) ??
    root?.querySelector<HTMLElement>('[data-part="content"]') ??
    null
  const open = trigger.getAttribute('aria-expanded') !== 'true'
  trigger.setAttribute('aria-expanded', String(open))
  setOpenState([root, trigger], open)
  if (content) revealPanel(content, open)
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/** A tab's panel. Ark names only the selected tab's in `aria-controls`; the rest follow its id scheme. */
function tabPanel(trigger: HTMLElement, list: HTMLElement): HTMLElement | null {
  const value = trigger.getAttribute('data-value')
  const base = list.id.replace(/:list$/, '')
  return byId(
    trigger,
    trigger.getAttribute('aria-controls') ?? (value ? `${base}:content-${value}` : null),
  )
}

function selectTab(trigger: HTMLElement) {
  const list = trigger.closest<HTMLElement>('[data-scope="tabs"][data-part="list"]')
  if (!list) return
  for (const other of list.querySelectorAll<HTMLElement>(
    '[data-scope="tabs"][data-part="trigger"]',
  )) {
    if (other.closest('[data-scope="tabs"][data-part="list"]') !== list) continue
    const selected = other === trigger
    other.setAttribute('aria-selected', String(selected))
    other.tabIndex = selected ? 0 : -1
    if (selected) other.setAttribute('data-selected', '')
    else other.removeAttribute('data-selected')
    const panel = tabPanel(other, list)
    if (!panel) continue
    if (selected) other.setAttribute('aria-controls', panel.id)
    else other.removeAttribute('aria-controls')
    panel.hidden = !selected
    if (selected) panel.setAttribute('data-selected', '')
    else panel.removeAttribute('data-selected')
  }
  // The sliding underline, where the tabs have one.
  const indicator = list.querySelector<HTMLElement>('[data-scope="tabs"][data-part="indicator"]')
  if (indicator) {
    indicator.hidden = false
    indicator.style.setProperty('--left', `${trigger.offsetLeft}px`)
    indicator.style.setProperty('--top', `${trigger.offsetTop}px`)
    indicator.style.setProperty('--width', `${trigger.offsetWidth}px`)
    indicator.style.setProperty('--height', `${trigger.offsetHeight}px`)
  }
}

/* -------------------------------------------------------------------------- */
/* Dialogs and drawers                                                        */
/* -------------------------------------------------------------------------- */

/** The dialog's parts, from its content element's Ark id. */
function dialogParts(content: HTMLElement) {
  const base = content.id.replace(/:content$/, '')
  return {
    content,
    backdrop: byId(content, `${base}:backdrop`),
    positioner: content.closest<HTMLElement>('[data-scope="dialog"][data-part="positioner"]'),
    trigger: byId(content, `${base}:trigger`),
  }
}

/** Open dialogs, most recent last, with what had focus before each. */
const openDialogs: Array<{ content: HTMLElement; returnTo: HTMLElement | null }> = []

function topDialog(doc: Document): HTMLElement | null {
  for (let index = openDialogs.length - 1; index >= 0; index--) {
    const entry = openDialogs[index]!
    if (entry.content.ownerDocument === doc && entry.content.isConnected) return entry.content
  }
  return null
}

/** An age gate is answered, never dismissed by tapping away or Escape. */
function dismissable(content: HTMLElement): boolean {
  return closestHome(content, '[data-pb-popup="age"]') === null
}

function lockScroll(doc: Document, locked: boolean) {
  const body = doc.body
  if (locked) {
    if (body.hasAttribute('data-pb-scroll-lock')) return
    const gap = (doc.defaultView?.innerWidth ?? 0) - doc.documentElement.clientWidth
    body.setAttribute('data-pb-scroll-lock', body.style.overflow)
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return
  }
  if (!body.hasAttribute('data-pb-scroll-lock')) return
  body.style.overflow = body.getAttribute('data-pb-scroll-lock') ?? ''
  body.style.paddingRight = ''
  body.removeAttribute('data-pb-scroll-lock')
}

export function openDialog(content: HTMLElement, opener?: HTMLElement | null) {
  if (content.getAttribute('data-state') === 'open') return
  const { backdrop, positioner, trigger } = dialogParts(content)
  lift(backdrop)
  lift(positioner)
  for (const part of [backdrop, content]) {
    if (!part) continue
    part.hidden = false
    part.setAttribute('data-state', 'open')
  }
  if (positioner) positioner.style.pointerEvents = ''
  trigger?.setAttribute('aria-expanded', 'true')
  trigger?.setAttribute('data-state', 'open')
  openDialogs.push({
    content,
    returnTo: opener ?? (content.ownerDocument.activeElement as HTMLElement | null),
  })
  lockScroll(content.ownerDocument, true)
  const first = focusables(content)[0]
  ;(first ?? content).focus({ preventScroll: true })
}

export function closeDialog(content: HTMLElement) {
  if (content.getAttribute('data-state') !== 'open') return
  const { backdrop, positioner, trigger } = dialogParts(content)
  for (const part of [backdrop, content]) part?.setAttribute('data-state', 'closed')
  trigger?.setAttribute('aria-expanded', 'false')
  trigger?.setAttribute('data-state', 'closed')
  const index = openDialogs.findIndex((entry) => entry.content === content)
  const entry = index >= 0 ? openDialogs.splice(index, 1)[0] : undefined
  if (!openDialogs.some((other) => other.content.ownerDocument === content.ownerDocument)) {
    lockScroll(content.ownerDocument, false)
  }
  afterAnimation(content, () => {
    if (content.getAttribute('data-state') !== 'closed') return
    content.hidden = true
    if (backdrop) backdrop.hidden = true
    if (positioner) positioner.style.pointerEvents = 'none'
    lower(backdrop)
    lower(positioner)
  })
  entry?.returnTo?.focus({ preventScroll: true })
  // A popup's dialog remembers it was dismissed, however it was closed.
  const popup = closestHome(content, '[data-pb-popup]')
  if (popup) rememberPopup(popup)
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.closest('[hidden]') && !element.closest('[inert]'))
}

function trapFocus(event: KeyboardEvent, doc: Document) {
  const content = topDialog(doc)
  if (!content) return
  const items = focusables(content)
  if (items.length === 0) {
    event.preventDefault()
    content.focus()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = doc.activeElement
  if (event.shiftKey && (active === first || !content.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !content.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

/* -------------------------------------------------------------------------- */
/* Floating parts: the header's dropdowns (hover) and popovers (click)        */
/* -------------------------------------------------------------------------- */

/**
 * Put a floating panel next to its trigger: below for a dropdown, above for a
 * popover, centred on the trigger and kept on screen.
 */
function place(positioner: HTMLElement, trigger: HTMLElement, side: 'top' | 'bottom', gutter = 6) {
  const view = viewOf(trigger)
  const rect = trigger.getBoundingClientRect()
  positioner.style.position = 'fixed'
  positioner.style.transform = 'none'
  positioner.style.pointerEvents = 'auto'
  const panel = positioner.getBoundingClientRect()
  const width = view.document.documentElement.clientWidth
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - panel.width / 2, width - panel.width - 8),
  )
  const top = side === 'bottom' ? rect.bottom + gutter : rect.top - panel.height - gutter
  positioner.style.left = `${left}px`
  positioner.style.top = `${Math.max(8, top)}px`
}

function floatingParts(trigger: HTMLElement, scope: 'hover-card' | 'popover') {
  const base = trigger.id.replace(/:trigger$/, '')
  return {
    content: byId(trigger, `${base}:content`),
    positioner: byId(trigger, `${base}:popper`),
  }
}

function showFloating(
  trigger: HTMLElement,
  scope: 'hover-card' | 'popover',
  side: 'top' | 'bottom',
) {
  const { content, positioner } = floatingParts(trigger, scope)
  if (!content || !positioner) return
  lift(positioner)
  content.hidden = false
  setOpenState([trigger, content], true)
  trigger.setAttribute('aria-expanded', 'true')
  place(positioner, trigger, side)
}

function hideFloating(trigger: HTMLElement, scope: 'hover-card' | 'popover') {
  const { content, positioner } = floatingParts(trigger, scope)
  if (!content || !positioner) return
  setOpenState([trigger, content], false)
  trigger.setAttribute('aria-expanded', 'false')
  afterAnimation(content, () => {
    if (content.getAttribute('data-state') !== 'closed') return
    content.hidden = true
    positioner.style.pointerEvents = 'none'
    lower(positioner)
  })
}

/** Hover cards open after a short rest and close after a short grace, as Ark's do. */
const hoverTimers = new WeakMap<HTMLElement, number>()

function hoverCardOf(target: Element | null): HTMLElement | null {
  if (!target?.closest) return null
  const trigger = target.closest<HTMLElement>('[data-scope="hover-card"][data-part="trigger"]')
  if (trigger) return trigger
  const panel = target.closest<HTMLElement>('[data-scope="hover-card"][data-part="positioner"]')
  if (!panel) return null
  return byId(panel, panel.id.replace(/:popper$/, ':trigger'))
}

function scheduleHover(trigger: HTMLElement, open: boolean) {
  const view = viewOf(trigger)
  const pending = hoverTimers.get(trigger)
  if (pending !== undefined) view.clearTimeout(pending)
  hoverTimers.set(
    trigger,
    view.setTimeout(
      () =>
        open ? showFloating(trigger, 'hover-card', 'bottom') : hideFloating(trigger, 'hover-card'),
      open ? 80 : 150,
    ),
  )
}

function onPointerOver(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  const trigger = hoverCardOf(event.target as Element)
  if (trigger) scheduleHover(trigger, true)
}

function onPointerOut(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  const trigger = hoverCardOf(event.target as Element)
  if (!trigger) return
  // Moving between the trigger and its own panel keeps it open.
  if (hoverCardOf(event.relatedTarget as Element | null) === trigger) return
  scheduleHover(trigger, false)
}

function onFocusIn(event: FocusEvent) {
  const target = event.target as Element | null
  const trigger = hoverCardOf(target)
  if (trigger) scheduleHover(trigger, true)
  // Focus leaving a hover card's trigger and panel closes it.
  const doc = documentOf(event)
  for (const open of doc.querySelectorAll<HTMLElement>(
    '[data-scope="hover-card"][data-part="trigger"][data-state="open"]',
  )) {
    if (open !== trigger) scheduleHover(open, false)
  }
}

function togglePopover(trigger: HTMLElement) {
  const open = trigger.getAttribute('data-state') !== 'open'
  closeAllPopovers(trigger)
  if (open) showFloating(trigger, 'popover', 'top')
}

function closeAllPopovers(from: Element) {
  for (const open of from.ownerDocument.querySelectorAll<HTMLElement>(
    '[data-scope="popover"][data-part="trigger"][data-state="open"]',
  )) {
    hideFloating(open, 'popover')
  }
}

/* -------------------------------------------------------------------------- */
/* Voucher codes                                                              */
/* -------------------------------------------------------------------------- */

async function copyCode(button: HTMLElement) {
  const code = button.getAttribute('data-pb-copy')
  if (!code) return
  try {
    await viewOf(button).navigator.clipboard.writeText(code)
  } catch {
    // Clipboard refused: the code is on screen to copy by hand.
    return
  }
  const idle = button.querySelector<HTMLElement>('[data-pb-copy-idle]')
  const done = button.querySelector<HTMLElement>('[data-pb-copy-done]')
  if (idle) idle.hidden = true
  if (done) done.hidden = false
  viewOf(button).setTimeout(() => {
    if (idle) idle.hidden = false
    if (done) done.hidden = true
  }, 2000)
}

/* -------------------------------------------------------------------------- */
/* Popup and splash                                                           */
/* -------------------------------------------------------------------------- */

function popupKey(popup: HTMLElement) {
  return `pb-popup:${popup.getAttribute('data-pb-popup')}`
}

function rememberPopup(popup: HTMLElement) {
  writeStorage(popup, popupKey(popup), '1')
}

function closePopup(button: HTMLElement) {
  const popup = closestHome(button, '[data-pb-popup]')
  if (!popup) return
  rememberPopup(popup)
  if (popup.getAttribute('data-pb-popup') === 'cookie') return setHidden(popup, true)
  const content = button.closest<HTMLElement>('[data-scope="dialog"][data-part="content"]')
  if (content) closeDialog(content)
}

function mountPopup(popup: HTMLElement): Cleanup | void {
  const kind = popup.getAttribute('data-pb-popup')
  const view = viewOf(popup)
  const seen = popup.hasAttribute('data-pb-once') && readStorage(popup, popupKey(popup)) === '1'
  if (kind === 'cookie') {
    // The bar is in the page from the start, so it works without scripts;
    // a shopper who already answered it this session never sees it again.
    if (seen) setHidden(popup, true)
    return
  }
  if (seen) return
  const content = popup.querySelector<HTMLElement>('[data-scope="dialog"][data-part="content"]')
  if (!content) return
  if (kind === 'exit') {
    let shown = false
    const onLeave = (event: MouseEvent) => {
      if (shown || event.clientY > 0) return
      shown = true
      openDialog(content)
    }
    view.document.addEventListener('mouseout', onLeave)
    return () => view.document.removeEventListener('mouseout', onLeave)
  }
  const delay = Number(popup.getAttribute('data-pb-delay') ?? '0') * 1000
  const timer = view.setTimeout(() => openDialog(content), delay)
  return () => view.clearTimeout(timer)
}

function mountSplash(splash: HTMLElement): Cleanup | void {
  // The inline head script already hid it for a visit that skips; this one
  // plays, so the next page in this tab skips.
  const key = splash.getAttribute('data-pb-splash-once')
  if (key && !splash.ownerDocument.documentElement.hasAttribute('data-splash-skip')) {
    writeStorage(splash, key, '1')
  }
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function mountHeader(header: HTMLElement): Cleanup {
  const view = viewOf(header)
  const root = header.ownerDocument.documentElement
  const transparent = header.hasAttribute('data-pb-transparent')
  const sticky = header.hasAttribute('data-pb-sticky')

  const write = () => {
    const height = `${header.getBoundingClientRect().height}px`
    root.style.setProperty(HEADER_HEIGHT_VAR, transparent ? '0px' : height)
    root.style.setProperty(HEADER_OFFSET_VAR, sticky ? height : '0px')
  }
  write()
  const observer = 'ResizeObserver' in view ? new view.ResizeObserver(write) : null
  observer?.observe(header)

  // See-through over the first section until the shopper scrolls.
  const read = () => {
    if (view.scrollY > 24) header.removeAttribute('data-transparent')
    else header.setAttribute('data-transparent', '')
  }
  if (transparent) {
    read()
    view.addEventListener('scroll', read, { passive: true })
  }

  return () => {
    observer?.disconnect()
    view.removeEventListener('scroll', read)
    root.style.removeProperty(HEADER_HEIGHT_VAR)
    root.style.removeProperty(HEADER_OFFSET_VAR)
  }
}

/** The strip above the header: several announcements take turns every few seconds. */
function mountAnnouncements(strip: HTMLElement): Cleanup | void {
  const items = [...strip.children] as HTMLElement[]
  if (items.length < 2 || reducedMotion(strip)) return
  const view = viewOf(strip)
  let index = 0
  const timer = view.setInterval(() => {
    items[index]!.hidden = true
    index = (index + 1) % items.length
    items[index]!.hidden = false
  }, 5000)
  return () => view.clearInterval(timer)
}

/* -------------------------------------------------------------------------- */
/* Countdown                                                                  */
/* -------------------------------------------------------------------------- */

function mountCountdown(root: HTMLElement): Cleanup | void {
  const end = Date.parse(root.getAttribute('data-pb-countdown') ?? '')
  if (Number.isNaN(end)) return
  const view = viewOf(root)
  const units = new Map<string, HTMLElement>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-pb-unit]')) {
    units.set(element.getAttribute('data-pb-unit')!, element)
  }

  const finish = () => {
    if (root.getAttribute('data-pb-after-end') === 'message') {
      for (const child of root.children as HTMLCollectionOf<HTMLElement>) {
        setHidden(child, !child.hasAttribute('data-pb-countdown-ended'))
      }
      return
    }
    // A sale that has ended leaves the page, as on the React storefront.
    setHidden(root.closest<HTMLElement>('[id^="section-"]') ?? root, true)
  }

  const tick = () => {
    const left = end - Date.now()
    if (left <= 0) {
      view.clearInterval(timer)
      finish()
      return
    }
    const total = Math.floor(left / 1000)
    const parts: Record<string, number> = {
      days: Math.floor(total / 86_400),
      hours: Math.floor((total % 86_400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    }
    for (const [key, element] of units) {
      element.textContent = String(parts[key] ?? 0).padStart(2, '0')
    }
  }
  const timer = view.setInterval(tick, 1000)
  tick()
  return () => view.clearInterval(timer)
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                     */
/* -------------------------------------------------------------------------- */

interface SliderConfig {
  count: number
  perPage: Record<string, number>
  loop: boolean
  autoplay: boolean
  autoplayMs?: number
  vertical: boolean
  gap?: string
  start?: number
  breakpoints: Record<string, string>
}

const BREAKPOINT_ORDER = ['sm', 'md', 'lg', 'xl', '2xl']

/**
 * The same slider as `render/slider.tsx`, step for step: a flex row shifted by
 * a transform, a loop that wraps onto doubles of the slides at each end, a
 * finger that drags and flings, autoplay held while the pointer or focus is on
 * it. React keeps this in state; here it is in this closure, and every change
 * is written straight to the track.
 */
function mountSlider(root: HTMLElement): Cleanup | void {
  let config: SliderConfig
  try {
    config = JSON.parse(root.getAttribute('data-pb-slider') ?? '')
  } catch {
    return
  }
  const view = viewOf(root)
  const own = <T extends Element = HTMLElement>(selector: string) =>
    [...root.querySelectorAll<T>(selector)].filter(
      (element) => element.closest('[data-pb-slider]') === root,
    )
  const band = own('[data-slider-band]')[0]
  const track = own('[data-slider-track]')[0]
  if (!band || !track) return
  const real = ([...track.children] as HTMLElement[]).filter(
    (slide) => slide.hasAttribute('data-slider-slide') && !slide.hasAttribute('data-pb-clone'),
  )
  const prevs = own('[data-pb-slider-prev]') as HTMLButtonElement[]
  const nexts = own('[data-pb-slider-next]') as HTMLButtonElement[]
  const dots = own('[data-pb-slider-dot]')
  const counter = own('[data-pb-slider-count]')[0]
  const toggle = own('[data-pb-slider-toggle]')[0]
  const under = own('[data-pb-slider-under]')[0]

  const count = real.length
  const gap = config.gap ?? DEFAULT_GAP
  const vertical = config.vertical
  const loop = config.loop
  const autoplayMs = config.autoplayMs ?? AUTOPLAY_MS

  let geometry: SliderGeometry = sliderGeometry(count, config.perPage.base ?? 1, {
    loop,
    wrap: true,
  })
  let index = Math.max(0, Math.min(config.start ?? 0, geometry.end))
  let playing = config.autoplay
  let paused = false
  let dragging = false
  let dragPx = 0
  let snapping = false
  let glide: { ms: number; ease: string } | null = null
  let wanted = 0
  let autoplayTimer: number | undefined
  let fallbackTimer: number | undefined
  let drag: { pointerId: number; x: number; samples: Array<{ x: number; time: number }> } | null =
    null

  const wrapping = () => index < 0 || index >= count
  const busy = () => wrapping() || snapping
  const at = () => (wrapping() ? (index < 0 ? geometry.end : 0) : Math.min(index, geometry.end))

  /** The slides per view the browser's width asks for. */
  const resolvePerPage = () => {
    let value = config.perPage.base ?? 1
    for (const key of BREAKPOINT_ORDER) {
      const wanted = config.perPage[key]
      const min = config.breakpoints[key]
      if (wanted === undefined || !min) continue
      if (view.matchMedia(`(min-width: ${min})`).matches) value = wanted
    }
    return value
  }

  /** Rebuild the doubles a wrapping loop glides onto. */
  const rebuildDoubles = () => {
    for (const clone of track.querySelectorAll(':scope > [data-pb-clone]')) clone.remove()
    const { doubles, rotating } = geometry
    if (doubles === 0) return
    const tail = rotating
      ? Array.from({ length: doubles }, (_, position) => real[(count - 1 + position) % count]!)
      : real.slice(-doubles)
    const head = real.slice(0, doubles)
    const copy = (slide: HTMLElement) => {
      const clone = slide.cloneNode(true) as HTMLElement
      clone.setAttribute('data-pb-clone', '')
      clone.setAttribute('inert', '')
      clone.setAttribute('aria-hidden', 'true')
      return clone
    }
    const first = real[0]!
    for (const slide of tail) track.insertBefore(copy(slide), first)
    for (const slide of head) track.appendChild(copy(slide))
  }

  /** Write the current position, controls and all, to the page. */
  const paint = () => {
    const rest = wrapping() ? index : Math.min(index, geometry.last)
    track.style.transition =
      dragging || snapping
        ? 'none'
        : `transform ${glide?.ms ?? SLIDE_MS}ms ${glide?.ease ?? SLIDE_EASE}`
    track.style.transform = sliderTransform(
      rest + geometry.doubles,
      geometry.perPage,
      dragPx,
      gap,
      vertical,
    )
    const position = at()
    for (const button of prevs) button.disabled = !loop && position === 0
    for (const button of nexts) button.disabled = !loop && position >= geometry.end
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === position) dot.setAttribute('aria-current', 'true')
      else dot.removeAttribute('aria-current')
    })
    if (counter) counter.textContent = `${position + 1} / ${geometry.end + 1}`
    if (wrapping() && fallbackTimer === undefined) {
      // Should the glide's end never come (a hidden section), settle anyway.
      fallbackTimer = view.setTimeout(() => {
        fallbackTimer = undefined
        settle()
      }, WRAP_FALLBACK_MS)
    }
  }

  /** Lay the slider out for the current width: slide size, doubles, controls. */
  const layout = () => {
    const next = sliderGeometry(count, resolvePerPage(), { loop, wrap: true })
    const rebuilt = next.doubles !== geometry.doubles || next.rotating !== geometry.rotating
    geometry = next
    if (rebuilt || !track.querySelector(':scope > [data-pb-clone]')) rebuildDoubles()
    const flex = `0 0 calc(${sliderBasis(geometry.perPage, gap)})`
    for (const slide of track.children as HTMLCollectionOf<HTMLElement>) slide.style.flex = flex
    index = index < 0 ? geometry.end : index >= count ? 0 : Math.min(index, geometry.end)
    for (const button of [...prevs, ...nexts]) setHidden(button, !geometry.paged)
    dots.forEach((dot, dotIndex) => setHidden(dot, !geometry.paged || dotIndex > geometry.end))
    if (under) setHidden(under, !geometry.paged)
    // A new layout lands at once; only moves between positions glide.
    snapping = true
    paint()
    void track.offsetWidth
    snapping = false
    paint()
    restartAutoplay()
  }

  const goTo = (to: number, glideMs?: number) => {
    glide = glideMs ? { ms: glideMs, ease: FLING_EASE } : null
    const { end, wraps, doubles } = geometry
    if (to < 0) index = wraps ? -doubles : loop ? end : 0
    else index = to > end ? (wraps ? count : loop ? 0 : end) : to
    paint()
  }

  const step = (delta: number) => {
    // Retargeting a wrap mid-glide would animate the long way round.
    if (busy()) {
      wanted += delta
      return
    }
    goTo(index + delta)
  }

  const select = (position: number) => {
    if (busy()) {
      wanted = position - at()
      return
    }
    glide = null
    index = position
    paint()
  }

  /** The glide onto a double has finished: jump back onto the real slide, unseen. */
  const settle = () => {
    if (fallbackTimer !== undefined) {
      view.clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    }
    if (!wrapping()) return
    snapping = true
    index = at()
    paint()
    nextFrame(view, () => {
      snapping = false
      paint()
      if (wanted === 0) return
      nextFrame(view, () => {
        const delta = wanted
        wanted = 0
        goTo(index + delta)
      })
    })
  }

  const restartAutoplay = () => {
    if (autoplayTimer !== undefined) view.clearInterval(autoplayTimer)
    autoplayTimer = undefined
    if (!playing || !geometry.paged || paused || dragging) return
    autoplayTimer = view.setInterval(() => {
      if (wrapping()) return
      const resting = Math.min(index, geometry.end)
      glide = null
      index = resting < geometry.end ? resting + 1 : geometry.wraps ? count : loop ? 0 : resting
      paint()
    }, autoplayMs)
  }

  const paintToggle = () => {
    if (!toggle) return
    const label = toggle.getAttribute(playing ? 'data-pb-label-pause' : 'data-pb-label-play')
    if (label) toggle.setAttribute('aria-label', label)
    const playingIcon = toggle.querySelector<HTMLElement>('[data-pb-icon-playing]')
    const pausedIcon = toggle.querySelector<HTMLElement>('[data-pb-icon-paused]')
    if (playingIcon) playingIcon.hidden = !playing
    if (pausedIcon) pausedIcon.hidden = playing
  }

  const stepWidth = () => {
    const first = band.querySelector<HTMLElement>('[data-slider-slide]')
    const rect = first?.getBoundingClientRect()
    if (!rect) return 0
    const size = vertical ? rect.height : rect.width
    return size > 0 ? size + Number.parseFloat(gap) : 0
  }

  const endDrag = () => {
    drag = null
    dragging = false
    dragPx = 0
    glide = null
  }

  const listeners: Array<[EventTarget, string, EventListener]> = []
  const on = <E extends Event>(target: EventTarget, type: string, listener: (event: E) => void) => {
    target.addEventListener(type, listener as EventListener)
    listeners.push([target, type, listener as EventListener])
  }

  for (const button of prevs) on(button, 'click', () => step(-1))
  for (const button of nexts) on(button, 'click', () => step(1))
  dots.forEach((dot, position) => on(dot, 'click', () => select(position)))
  if (toggle) {
    on(toggle, 'click', () => {
      playing = !playing
      paintToggle()
      restartAutoplay()
    })
  }

  on(track, 'transitionend', (event: TransitionEvent) => {
    if (event.target !== track) return
    if (event.propertyName && event.propertyName !== 'transform') return
    glide = null
    settle()
  })

  on(band, 'pointerdown', (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || !geometry.paged) return
    const point = vertical ? event.clientY : event.clientX
    drag = { pointerId: event.pointerId, x: point, samples: [{ x: point, time: gestureTime() }] }
    glide = null
    dragging = true
    restartAutoplay()
    paint()
  })
  on(band, 'pointermove', (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = vertical ? event.clientY : event.clientX
    dragPx = point - drag.x
    drag.samples.push({ x: point, time: gestureTime() })
    const last = drag.samples[drag.samples.length - 1]!
    drag.samples = drag.samples.filter((sample) => sample.time >= last.time - FLING_SAMPLE_MS)
    paint()
  })
  on(band, 'pointerup', (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = vertical ? event.clientY : event.clientX
    const moved = point - drag.x
    const velocity = releaseVelocity([...drag.samples, { x: point, time: gestureTime() }])
    endDrag()
    restartAutoplay()
    const width = stepWidth()
    if (width > 0) {
      const steps = Math.round(-(moved + velocity * FLING_PROJECTION_MS) / width)
      if (steps !== 0) goTo(at() + steps, flingGlideMs(steps, velocity))
      else paint()
      return
    }
    if (moved <= -SLIDE_SWIPE_PX) step(1)
    else if (moved >= SLIDE_SWIPE_PX) step(-1)
    else paint()
  })
  on(band, 'pointercancel', () => {
    endDrag()
    restartAutoplay()
    paint()
  })
  const hold = (value: boolean) => () => {
    paused = value
    restartAutoplay()
  }
  on(band, 'pointerenter', (event: PointerEvent) => {
    if (event.pointerType === 'mouse') hold(true)()
  })
  on(band, 'pointerleave', (event: PointerEvent) => {
    if (event.pointerType === 'mouse') hold(false)()
  })
  on(band, 'focusin', hold(true))
  on(band, 'focusout', hold(false))

  // A breakpoint crossed changes how many slides are in view.
  const queries = BREAKPOINT_ORDER.filter(
    (key) => config.perPage[key] !== undefined && config.breakpoints[key],
  ).map((key) => view.matchMedia(`(min-width: ${config.breakpoints[key]})`))
  for (const query of queries) on(query, 'change', layout)
  // And on resize, for browsers (and emulators) that skip the media event:
  // only when the view's slide count actually changed.
  on(view, 'resize', () => {
    if (
      sliderGeometry(count, resolvePerPage(), { loop, wrap: true }).perPage !== geometry.perPage
    ) {
      layout()
    }
  })

  paintToggle()
  layout()

  return () => {
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener)
    if (autoplayTimer !== undefined) view.clearInterval(autoplayTimer)
    if (fallbackTimer !== undefined) view.clearTimeout(fallbackTimer)
  }
}
