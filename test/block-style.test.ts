import { describe, expect, test } from 'bun:test'

import {
  BLOCK_STYLE_FIELDS,
  blockSchema,
  blockStyleCss,
  createSection,
  defineBlock,
  duplicateBlock,
  findBlock,
  readBlocks,
  registeredBlock,
  sanitizeValues,
  sectionSchema,
  updateBlockStyle,
} from '../src/index'
import type { BlockValue } from '../src/index'

function blocksField() {
  const schema = sectionSchema('blocks')
  if (!schema) throw new Error('the blocks section is not registered')
  const field = schema.fields.find((candidate) => candidate.key === 'blocks')
  if (!field || field.kind !== 'blocks') throw new Error('the blocks field is missing')
  return field
}

function stored(block: Record<string, unknown>) {
  const field = blocksField()
  const values = sanitizeValues([field], { blocks: [block] })
  return { field, values, block: readBlocks(values, 'blocks')[0] }
}

describe('the block style allowlist', () => {
  test('offers the requested properties', () => {
    const keys = BLOCK_STYLE_FIELDS.map((field) => field.key)
    for (const key of [
      'position',
      'zIndex',
      'backgroundSize',
      'backgroundPosition',
      'backgroundRepeat',
      'backgroundAttachment',
      'inset',
      'borderRadius',
      'opacity',
      'transform',
      // Sizing, for every block.
      'width',
      'height',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'bleed',
      // Text, for blocks that draw words.
      'fontSize',
      'color',
      'fontFamily',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textTransform',
      'fontStyle',
      'textDecoration',
      'textAlign',
      // Hover reactions, self or group-triggered.
      'hoverTrigger',
      'hoverTransform',
      'hoverFilter',
      'hoverShadow',
      'hoverDecoration',
      'hoverColor',
      'hoverColorCustom',
      'hoverBackgroundTheme',
      'hoverBackgroundColor',
    ]) {
      expect(keys).toContain(key)
    }
  })

  test('the blocks field carries the allowlist so every block can override', () => {
    expect(blocksField().styleFields).toBe(BLOCK_STYLE_FIELDS)
  })
})

describe('sanitising a block style', () => {
  test('keeps allowlisted tokens and drops unknown keys and defaults', () => {
    const { block } = stored({
      id: 'a',
      type: 'heading',
      settings: { text: 'A' },
      style: {
        position: 'absolute',
        zIndex: '10',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 100,
        rawCss: 'url(https://evil.example/x.png)',
        className: 'x',
      },
    })
    expect(block!.style).toEqual({
      position: 'absolute',
      zIndex: '10',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    })
  })

  test('drops token values outside the allowlist', () => {
    const { block } = stored({
      id: 'a',
      type: 'text',
      settings: { body: 'x' },
      style: { position: 'explode', backgroundSize: 'cover' },
    })
    expect(block!.style).toEqual({ backgroundSize: 'cover' })
  })

  test('a style set entirely to defaults is not stored at all', () => {
    const { block } = stored({
      id: 'a',
      type: 'spacer',
      settings: {},
      style: { position: 'default', opacity: 100, backgroundColor: '' },
    })
    expect(block!.style).toBeUndefined()
  })

  test('theme tokens and custom colours survive sanitising', () => {
    const { block } = stored({
      id: 'a',
      type: 'column',
      settings: {},
      style: {
        backgroundColorTheme: 'brand',
        borderColorTheme: 'nonsense',
        borderColor: '#ABCDEF',
      },
    })
    // A known token and a valid hex stay; an invented token falls back to the
    // field default and is not stored.
    expect(block!.style).toEqual({ backgroundColorTheme: 'brand', borderColor: '#abcdef' })
  })
})

describe('resolving a block style to CSS', () => {
  test('tokens become plain CSS, unknown values are ignored', () => {
    const css = blockStyleCss({
      position: 'absolute',
      zIndex: '30',
      inset: '2',
      top: '4',
      backgroundSize: 'cover',
      backgroundPosition: 'bottom-right',
      borderRadius: 'lg',
      opacity: 50,
      transform: 'scale-105',
      pointerEvents: 'none',
    })
    expect(css).toMatchObject({
      position: 'absolute',
      zIndex: 30,
      top: '1rem',
      right: '0.5rem',
      bottom: '0.5rem',
      left: '0.5rem',
      backgroundSize: 'cover',
      backgroundPosition: 'bottom right',
      borderRadius: '0.5rem',
      opacity: 0.5,
      transform: 'scale(1.05)',
      pointerEvents: 'none',
    })
  })

  test('a style with nothing set resolves to the shared empty object', () => {
    expect(blockStyleCss(undefined)).toEqual({})
    expect(blockStyleCss({ position: 'default', opacity: 100 })).toEqual({})
  })

  test('theme colour tokens resolve to the theme variables', () => {
    // Text can name the whole theme vocabulary, accent included.
    expect(blockStyleCss({ color: 'accent' })).toMatchObject({ color: 'var(--pb-accent)' })
    expect(blockStyleCss({ color: 'bg-panel' })).toMatchObject({
      color: 'var(--chakra-colors-bg-panel)',
    })
    // Backgrounds and borders too, and a token wins over a stored hex.
    expect(blockStyleCss({ backgroundColorTheme: 'brand' })).toMatchObject({
      backgroundColor: 'var(--chakra-colors-brand-solid)',
    })
    expect(blockStyleCss({ backgroundColorTheme: 'brand-subtle' })).toMatchObject({
      backgroundColor: 'var(--chakra-colors-brand-subtle)',
    })
    expect(blockStyleCss({ borderColorTheme: 'border' })).toMatchObject({
      borderColor: 'var(--chakra-colors-border)',
    })
    expect(blockStyleCss({ backgroundColorTheme: 'bg', backgroundColor: '#123456' })).toMatchObject(
      { backgroundColor: 'var(--chakra-colors-bg)' },
    )
    // A custom hex alone still applies (layouts stored before the tokens).
    expect(blockStyleCss({ backgroundColor: '#123456' })).toMatchObject({
      backgroundColor: '#123456',
    })
    expect(blockStyleCss({ borderColor: '#abcdef' })).toMatchObject({ borderColor: '#abcdef' })
    // A transparent override is a token like any other.
    expect(blockStyleCss({ backgroundColorTheme: 'transparent' })).toMatchObject({
      backgroundColor: 'transparent',
    })
  })

  test('sticky gets a top offset so it actually sticks', () => {
    // Without an offset a sticky block never leaves its static spot.
    expect(blockStyleCss({ position: 'sticky' })).toEqual({ position: 'sticky', top: '0' })
    // A chosen top, inset or bottom still wins.
    expect(blockStyleCss({ position: 'sticky', top: '4' })).toEqual({
      position: 'sticky',
      top: '1rem',
    })
    expect(blockStyleCss({ position: 'sticky', inset: '2' })).toMatchObject({ top: '0.5rem' })
    const bottom = blockStyleCss({ position: 'sticky', bottom: '2' })
    expect(bottom).toEqual({ position: 'sticky', bottom: '0.5rem' })
    expect(bottom.top).toBeUndefined()
    // Only sticky needs the default.
    expect(blockStyleCss({ position: 'absolute' }).top).toBeUndefined()
  })

  test('typography and sizing tokens become plain CSS', () => {
    expect(
      blockStyleCss({
        fontSize: '3xl',
        color: 'custom',
        textColorCustom: '#112233',
        lineHeight: 'relaxed',
        textDecoration: 'underline',
        height: 'screen',
        maxWidth: '4xl',
        maxHeight: 'xl',
      }),
    ).toMatchObject({
      fontSize: 'var(--chakra-font-sizes-3xl)',
      color: '#112233',
      lineHeight: '1.7',
      textDecoration: 'underline',
      height: '100svh',
      maxWidth: '56rem',
      maxHeight: '24rem',
    })
    // A token colour resolves to the theme variable.
    expect(blockStyleCss({ color: 'fg-muted' }).color).toBe('var(--chakra-colors-fg-muted)')
  })

  test('full bleed escapes the page column, and default is not stored', () => {
    for (const bleed of ['full', 'band']) {
      expect(blockStyleCss({ bleed })).toMatchObject({
        width: '100cqw',
        maxWidth: 'none',
        marginInline: 'calc(50% - 50cqw)',
      })
    }
    // Bleed wins over a chosen width.
    expect(blockStyleCss({ bleed: 'band', width: '50' }).width).toBe('100cqw')

    const kept = stored({
      id: 'a',
      type: 'heading',
      settings: { text: 'A' },
      style: { bleed: 'band' },
    })
    expect(kept.block!.style).toEqual({ bleed: 'band' })
    const dropped = stored({
      id: 'a',
      type: 'heading',
      settings: { text: 'A' },
      style: { bleed: 'default' },
    })
    expect(dropped.block!.style).toBeUndefined()
  })
})

describe('editing a block style', () => {
  const field = blocksField()

  test('sets and clears overrides in place', () => {
    const values = sanitizeValues([field], {
      blocks: [
        { id: 'a', type: 'text', settings: { body: 'A' } },
        { id: 'b', type: 'text', settings: { body: 'B' } },
      ],
    })
    const styled = updateBlockStyle([field], values, 'a', { zIndex: '20' })!
    expect(findBlock([field], styled, 'a')?.block.style).toEqual({ zIndex: '20' })
    expect(findBlock([field], styled, 'b')?.block.style).toBeUndefined()

    const cleared = updateBlockStyle([field], styled, 'a', undefined)!
    expect(findBlock([field], cleared, 'a')?.block.style).toBeUndefined()
    expect('style' in (findBlock([field], cleared, 'a')!.block as BlockValue)).toBe(false)
  })

  test('duplicating a block copies its overrides', () => {
    const { field: target, values } = stored({
      id: 'a',
      type: 'text',
      settings: { body: 'A' },
      style: { zIndex: '20' },
    })
    const result = duplicateBlock([target], values, 'a')!
    expect(result.copy.style).toEqual({ zIndex: '20' })
  })
})

describe('custom blocks', () => {
  test('a registered block joins the library and sanitises its fields', () => {
    const callout = defineBlock({
      type: 'test-callout',
      name: { en: 'Callout', id: 'Sorotan' },
      fields: [
        { kind: 'text', key: 'text', label: { en: 'Text', id: 'Teks' }, max: 80, default: '' },
      ],
    })
    expect(registeredBlock('test-callout')).toBe(callout)
    expect(blockSchema('test-callout')).toBe(callout)

    const values = sanitizeValues([blocksField()], {
      blocks: [
        {
          id: 'c',
          type: 'test-callout',
          settings: { text: 'Hi', unknown: 'dropped' },
        },
      ],
    })
    const block = readBlocks(values, 'blocks')[0]
    expect(block?.type).toBe('test-callout')
    expect(block?.settings).toEqual({ text: 'Hi' })
  })

  test('replace-in-place keeps a type single and the picker order stable', () => {
    const first = defineBlock({
      type: 'test-replaced',
      name: { en: 'One', id: 'Satu' },
      fields: [],
    })
    const second = defineBlock({
      type: 'test-replaced',
      name: { en: 'Two', id: 'Dua' },
      fields: [],
    })
    expect(second).not.toBe(first)
    expect(registeredBlock('test-replaced')).toBe(second)
    expect(sectionSchema('blocks')).not.toBeNull()
  })
})

describe('layout blocks', () => {
  test('row and grid hold nested blocks and sanitise like any other', () => {
    const schema = blockSchema('row')
    expect(schema).not.toBeNull()
    expect(blockSchema('grid')).not.toBeNull()

    const field = blocksField()
    const values = sanitizeValues([field], {
      blocks: [
        {
          id: 'r',
          type: 'row',
          settings: {
            gap: 'lg',
            align: 'center',
            justify: 'between',
            wrap: true,
            stackOnMobile: true,
            blocks: [{ id: 'r-child', type: 'text', settings: { body: 'Beside' } }],
          },
        },
        {
          id: 'g',
          type: 'grid',
          settings: {
            columns: '3',
            blocks: [{ id: 'g-child', type: 'heading', settings: { text: 'In grid' } }],
          },
        },
      ],
    })
    expect(readBlocks(values, 'blocks').map((block) => block.type)).toEqual(['row', 'grid'])
    expect(findBlock([field], values, 'r-child')?.block.type).toBe('text')
    expect(findBlock([field], values, 'g-child')?.block.type).toBe('heading')
    expect(createSection('blocks', { blocks: [] })).toBeTruthy()
  })
})

describe('hover reactions', () => {
  test('a self trigger becomes a :hover rule with an explicit transition', () => {
    const css = blockStyleCss({
      hoverTransform: 'scale-105',
      hoverFilter: 'grayscale',
      hoverShadow: 'lg',
      hoverDecoration: 'underline',
      hoverColor: 'brand',
    })
    expect(css['&:hover']).toEqual({
      transform: 'scale(1.05)',
      filter: 'grayscale(1)',
      boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
      textDecoration: 'underline',
      color: 'var(--chakra-colors-brand-solid)',
    })
    expect(String(css.transition)).toContain('transform 200ms')
    // Never `all`: it animates layout and janks.
    expect(String(css.transition)).not.toContain('all')
  })

  test('the group trigger waits for the card around the block', () => {
    const css = blockStyleCss({ hoverTransform: 'scale-110', hoverTrigger: 'group' })
    expect(css['[data-block-hover-group]:hover &']).toEqual({ transform: 'scale(1.1)' })
    expect(css['&:hover']).toBeUndefined()
  })

  test('custom colours and background reach the rule', () => {
    const css = blockStyleCss({
      hoverColor: 'custom',
      hoverColorCustom: '#ff0000',
      hoverBackgroundColor: '#00ff00',
    })
    expect(css['&:hover']).toEqual({ color: '#ff0000', backgroundColor: '#00ff00' })
  })

  test('hover tokens survive sanitising and defaults are dropped', () => {
    const { block } = stored({
      id: 'h',
      type: 'text',
      settings: { body: 'x' },
      style: { hoverTransform: 'scale-105', hoverTrigger: 'self', hoverColor: 'default' },
    })
    expect(block!.style).toEqual({ hoverTransform: 'scale-105' })
  })

  test('unknown hover tokens resolve to nothing', () => {
    expect(blockStyleCss({ hoverTransform: 'scale-999' })).toEqual({})
    expect(blockStyleCss({ hoverTrigger: 'group' })).toEqual({})
  })
})
