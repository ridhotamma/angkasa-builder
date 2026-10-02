/**
 * SVG Section Dividers: smooth transitions between page sections.
 *
 * Adds wave, slant, curve, arc, and zigzag transitions between sections
 * without loading external images or heavy assets. Pure SVG and CSS.
 */

import { Box, type BoxProps } from '@chakra-ui/react'

import type { DividerShape } from '../model/section-style'

interface SectionDividerProps extends BoxProps {
  shape: DividerShape
  position: 'top' | 'bottom'
  color?: string
}

export function SectionDivider({ shape, position, color = 'var(--chakra-colors-bg)', ...rest }: SectionDividerProps) {
  if (shape === 'none') return null

  const isTop = position === 'top'

  // Height and positioning
  const containerStyle: BoxProps = {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    overflow: 'hidden',
    lineHeight: 0,
    pointerEvents: 'none',
    zIndex: 1,
    ...(isTop
      ? { top: 0, transform: 'translateY(-98%) rotate(180deg)' }
      : { bottom: 0, transform: 'translateY(98%)' }),
  }

  const svgProps = {
    viewBox: '0 0 1200 120',
    preserveAspectRatio: 'none',
    width: '100%',
    height: '40px',
    display: 'block',
    style: { fill: color },
  }

  const renderPath = () => {
    switch (shape) {
      case 'wave':
        return <path d="M0,0 C150,90 400,100 600,40 C800,-20 1050,70 1200,30 L1200,120 L0,120 Z" />
      case 'slant':
        return <polygon points="0,0 1200,120 0,120" />
      case 'curve':
        return <path d="M0,120 Q600,-40 1200,120 Z" />
      case 'arc':
        return <path d="M0,0 Q600,120 1200,0 L1200,120 L0,120 Z" />
      case 'zigzag':
        return (
          <polygon points="0,120 0,30 100,90 200,30 300,90 400,30 500,90 600,30 700,90 800,30 900,90 1000,30 1100,90 1200,30 1200,120" />
        )
      default:
        return null
    }
  }

  return (
    <Box {...containerStyle} {...rest}>
      <svg {...svgProps}>{renderPath()}</svg>
    </Box>
  )
}
