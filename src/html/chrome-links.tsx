/**
 * The header's cart, account and search controls for a page with no React in
 * the browser: plain links to the host's own pages, styled like the
 * storefront's icon buttons.
 */

import { Icon, IconButton } from '@chakra-ui/react'
import { LuSearch, LuShoppingBag, LuUser } from 'react-icons/lu'

import { StoreTab } from '../render/chrome'
import { useRenderText } from '../render/copy'

const ICONS = { cart: LuShoppingBag, account: LuUser, search: LuSearch } as const

export function HtmlChromeLink({
  kind,
  href,
  tab = false,
}: {
  kind: keyof typeof ICONS
  href: string
  /** Drawn as a tab in the phone's bottom bar instead of a header icon. */
  tab?: boolean
}) {
  const text = useRenderText()
  const label = text(kind)
  if (tab) {
    return (
      <StoreTab icon={ICONS[kind]} label={label} asChild>
        <a href={href} />
      </StoreTab>
    )
  }
  return (
    <IconButton asChild variant="ghost" size="sm" rounded="full" color="inherit" aria-label={label}>
      <a href={href} data-pb-chrome={kind}>
        <Icon as={ICONS[kind]} boxSize="4.5" />
      </a>
    </IconButton>
  )
}
