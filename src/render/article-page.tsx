/**
 * The article page's sections — the theme's frame around every article.
 *
 * The page is a template like the product page: the theme decides where the
 * cover goes, whether the date sits above the title, what comes after the
 * text, and every article follows. Its two required sections are the header,
 * drawn from `data.article`, and `article-content`, the slot the article's own
 * sections are drawn into. The storefront hands those sections in as
 * `env.slots.articleBody`; the theme editor has no article and shows a
 * stand-in body instead. See docs/ARTICLES.md.
 */

import {
  AspectRatio,
  Box,
  Button,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuCheck, LuLink } from 'react-icons/lu'
import { FaWhatsapp } from 'react-icons/fa6'

import { useLocale } from '@repo/i18n'
import { ImageWithFallback } from '@repo/theme'

import { readBoolean, readNumber, readText } from '../model/fields'
import {
  previewArticleDetail,
  useRenderEnvironment,
  type StorefrontArticleCard,
  type StorefrontArticleDetail,
} from './context'
import { useRenderText } from './copy'
import { EmptyNotice, SectionHeading, SmartLink, useCard } from './primitives'
import type { SectionProps } from './sections'

function useArticle(): StorefrontArticleDetail | null {
  const { data, mode } = useRenderEnvironment()
  if (data.article) return data.article
  return mode === 'preview' ? previewArticleDetail(data) : null
}

/**
 * An article's date, the same on the server and in the browser.
 *
 * A fixed zone rather than the reader's: the storefront renders on a server
 * in UTC and hydrates in Indonesia, and an article published late in the
 * evening would otherwise print one day in the HTML and another once the
 * page came alive. Indonesia's western zone, where most shops are.
 */
export function formatArticleDate(iso: string | null, locale: string): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(at)
}

/** Date · author, and the reading time when there is one, as one quiet line. */
function MetaLine({
  article,
  showDate = true,
  showAuthor = true,
  readingMinutes,
  justify,
}: {
  article: StorefrontArticleCard
  showDate?: boolean
  showAuthor?: boolean
  readingMinutes?: number | null
  justify?: 'center' | 'start'
}) {
  const { locale } = useLocale()
  const text = useRenderText()
  const parts = [
    showDate ? formatArticleDate(article.publishedAt, locale) : '',
    showAuthor ? (article.authorName ?? '') : '',
    readingMinutes ? text('readingTime', { n: readingMinutes }) : '',
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <HStack
      gap="2"
      wrap="wrap"
      justify={justify}
      fontSize="sm"
      color="fg.muted"
      css={{ '& > *:not(:last-child)::after': { content: '"·"', marginInlineStart: '2' } }}
    >
      {parts.map((part) => (
        <Text as="span" key={part}>
          {part}
        </Text>
      ))}
    </HStack>
  )
}

function Cover({ article, ratio = 16 / 9 }: { article: StorefrontArticleCard; ratio?: number }) {
  return (
    <AspectRatio ratio={ratio} rounded="l3" overflow="hidden" bg="bg.subtle">
      <ImageWithFallback
        src={article.coverUrl ?? undefined}
        alt={article.title}
        objectFit="cover"
        fallbackIconSize="10"
      />
    </AspectRatio>
  )
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One article as a card: cover, date, title and summary, linking to it. The
 * blog index draws its listing with these, and the related-articles section
 * its row — the same card in both places, under the theme's card style.
 */
export function ArticleCard({ article }: { article: StorefrontArticleCard }) {
  const { frame, flat, hover, tiltRef } = useCard()
  return (
    <Box ref={tiltRef} h="full" bg="bg.panel" rounded="l3" overflow="hidden" {...frame} {...hover}>
      <SmartLink
        link={{ kind: 'article', blogHandle: article.blogHandle, slug: article.slug }}
        display="flex"
        flexDirection="column"
        h="full"
      >
        {(article.coverUrl || !flat) && (
          <AspectRatio ratio={16 / 10} bg="bg.subtle" flexShrink="0" overflow="hidden">
            <ImageWithFallback
              src={article.coverUrl ?? undefined}
              alt={article.title}
              objectFit="cover"
              loading="lazy"
              transition="transform 600ms ease"
            />
          </AspectRatio>
        )}
        <Stack gap="2" p={flat ? '2' : { base: '4', md: '5' }} flex="1">
          <MetaLine article={article} showAuthor={false} />
          <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="semibold" lineClamp={2}>
            {article.title}
          </Text>
          {article.summary && (
            <Text fontSize="sm" color="fg.muted" lineClamp={3}>
              {article.summary}
            </Text>
          )}
        </Stack>
      </SmartLink>
    </Box>
  )
}

/** Articles in columns: one on a phone, two on a tablet, three from a desktop. */
export function ArticleGrid({ articles }: { articles: StorefrontArticleCard[] }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={{ base: '4', md: '6' }}>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </SimpleGrid>
  )
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export function ArticleHeader({ settings }: SectionProps) {
  const article = useArticle()
  const { mode } = useRenderEnvironment()
  if (!article) return null

  const center = readText(settings, 'align') === 'center'
  const cover = readText(settings, 'coverPosition')
  const metaAbove = readText(settings, 'metaPosition') === 'above'
  const justify = center ? 'center' : 'start'

  const meta = (
    <MetaLine
      article={article}
      showDate={readBoolean(settings, 'showDate')}
      showAuthor={readBoolean(settings, 'showAuthor')}
      readingMinutes={readBoolean(settings, 'showReadingTime') ? article.readingMinutes : null}
      justify={justify}
    />
  )

  const titleBlock = (
    <Stack gap="3" align={center ? 'center' : 'start'} textAlign={center ? 'center' : 'left'}>
      {readBoolean(settings, 'showBlog') && (
        <SmartLink
          link={{ kind: 'blog', blogHandle: article.blog.handle }}
          fontSize="sm"
          fontWeight="semibold"
          letterSpacing="0.06em"
          textTransform="uppercase"
          color="brand.fg"
        >
          {article.blog.title}
        </SmartLink>
      )}
      {metaAbove && meta}
      <Heading
        as="h1"
        size={{ base: '2xl', md: '4xl' }}
        letterSpacing="-0.02em"
        lineHeight="1.15"
        maxW="3xl"
      >
        {article.title}
      </Heading>
      {!metaAbove && meta}
      {readBoolean(settings, 'showTags') && article.tags.length > 0 && (
        <HStack gap="2" wrap="wrap" justify={justify}>
          {article.tags.map((tag) => (
            <SmartLink
              key={tag}
              link={{ kind: 'blog', blogHandle: article.blog.handle, tag }}
              fontSize="xs"
              px="2.5"
              py="1"
              rounded="full"
              bg="bg.subtle"
              color="fg.muted"
              _hover={{ color: 'fg' }}
            >
              {`#${tag}`}
            </SmartLink>
          ))}
        </HStack>
      )}
    </Stack>
  )

  // No cover on this article: the space is left out on the storefront, and
  // kept as a placeholder in the editor so the seller sees where one goes.
  const drawCover = cover !== 'none' && (article.coverUrl !== null || mode === 'preview')

  return (
    <Stack as="header" gap={{ base: '6', md: '8' }}>
      {drawCover && cover === 'above' && <Cover article={article} />}
      {titleBlock}
      {drawCover && cover !== 'above' && <Cover article={article} />}
    </Stack>
  )
}

/** Placeholder text the width of a real article, for the theme editor. */
function BodyStandIn() {
  const text = useRenderText()
  const line = (width: string) => <Box h="3" w={width} rounded="full" bg="bg.emphasized" />
  return (
    <Stack gap="6">
      <EmptyNotice>{text('articleBodyPreview')}</EmptyNotice>
      {[0, 1].map((paragraph) => (
        <Stack key={paragraph} gap="2.5" aria-hidden>
          {line('100%')}
          {line('96%')}
          {line('100%')}
          {line('72%')}
        </Stack>
      ))}
    </Stack>
  )
}

export function ArticleContent({ settings }: SectionProps) {
  const { slots, mode } = useRenderEnvironment()
  const body = slots?.articleBody ?? (mode === 'preview' ? <BodyStandIn /> : null)
  if (!body) return null
  // A narrow column is the reading measure; wide runs the page's own column.
  // Sections inside that run edge to edge still reach the page's edges: they
  // size against the page, not against this box.
  return (
    <Box w="full" mx="auto" maxW={readText(settings, 'width') === 'wide' ? undefined : '3xl'}>
      {body}
    </Box>
  )
}

export function ArticleShare({ settings }: SectionProps) {
  const article = useArticle()
  const { mode, href } = useRenderEnvironment()
  const text = useRenderText()
  const [copied, setCopied] = useState(false)
  if (!article) return null

  const center = readText(settings, 'align') === 'center'
  const label = readText(settings, 'label')
  const path = href({ kind: 'article', blogHandle: article.blogHandle, slug: article.slug }) ?? ''

  /** The article's address as the reader's browser knows it — the page may be on a custom domain. */
  const absolute = (element: HTMLElement) =>
    new URL(path, element.ownerDocument.defaultView?.location.href).toString()

  return (
    <Stack
      gap="3"
      align={center ? 'center' : 'start'}
      borderTopWidth="1px"
      borderColor="border.subtle"
      pt="6"
    >
      {label && (
        <Text fontSize="sm" fontWeight="medium" color="fg.muted">
          {label}
        </Text>
      )}
      <HStack gap="2" wrap="wrap">
        <Button
          size="sm"
          variant="outline"
          rounded="full"
          onClick={async (event) => {
            if (mode === 'preview') return
            const view = event.currentTarget.ownerDocument.defaultView
            try {
              await view?.navigator.clipboard.writeText(absolute(event.currentTarget))
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // Clipboard refused (an old browser, an insecure page): the
              // address bar still has the link.
            }
          }}
        >
          {copied ? <LuCheck /> : <LuLink />}
          {copied ? text('linkCopied') : text('copyLink')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          rounded="full"
          onClick={(event) => {
            if (mode === 'preview') return
            // Only the title and the link: nothing about the reader goes along.
            const message = `${article.title} ${absolute(event.currentTarget)}`
            event.currentTarget.ownerDocument.defaultView?.open(
              `https://wa.me/?text=${encodeURIComponent(message)}`,
              '_blank',
              'noopener,noreferrer',
            )
          }}
        >
          <FaWhatsapp />
          {text('whatsapp')}
        </Button>
      </HStack>
    </Stack>
  )
}

export function ArticlePagination({ settings }: SectionProps) {
  const article = useArticle()
  const text = useRenderText()
  if (!article) return null
  if (!article.previous && !article.next) return <EmptyNotice>{text('noPagination')}</EmptyNotice>

  const side = (
    target: { title: string; slug: string } | null,
    label: string,
    direction: 'previous' | 'next',
  ) =>
    target ? (
      <SmartLink
        link={{ kind: 'article', blogHandle: article.blog.handle, slug: target.slug }}
        display="flex"
        flexDirection="column"
        gap="1"
        p="4"
        rounded="l3"
        borderWidth="1px"
        borderColor="border.subtle"
        alignItems={direction === 'next' ? 'end' : 'start'}
        textAlign={direction === 'next' ? 'right' : 'left'}
        _hover={{ borderColor: 'brand.emphasized' }}
      >
        <HStack
          gap="1.5"
          fontSize="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="0.06em"
        >
          {direction === 'previous' && <LuArrowLeft />}
          <Text as="span">{label}</Text>
          {direction === 'next' && <LuArrowRight />}
        </HStack>
        <Text fontWeight="medium" lineClamp={2}>
          {target.title}
        </Text>
      </SmartLink>
    ) : (
      <Box />
    )

  return (
    <SimpleGrid as="nav" columns={{ base: 1, sm: 2 }} gap="3">
      {side(article.previous, readText(settings, 'previousLabel'), 'previous')}
      {side(article.next, readText(settings, 'nextLabel'), 'next')}
    </SimpleGrid>
  )
}

export function RelatedArticles({ settings }: SectionProps) {
  const article = useArticle()
  const text = useRenderText()
  const related = article?.related.slice(0, readNumber(settings, 'limit', 3)) ?? []
  if (related.length === 0) return <EmptyNotice>{text('noRelatedArticles')}</EmptyNotice>

  return (
    <Stack as="section" gap="4">
      <SectionHeading field="heading">{readText(settings, 'heading')}</SectionHeading>
      <ArticleGrid articles={related} />
    </Stack>
  )
}
