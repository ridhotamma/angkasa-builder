/**
 * Background patterns drawn in CSS gradients — no image to upload or load.
 *
 * Each is built from two colours the seller picks, `ink` for the pattern and
 * `paper` behind it. Both reach here already sanitised to `#rrggbb` (see the
 * `color` field in `../model/fields`), which is what makes interpolating them
 * into a CSS value safe.
 */

import type { SystemStyleObject } from '@chakra-ui/react'

export const PATTERN_KEYS = ['geometric', 'lines', 'scales', 'waves', 'dots', 'grid'] as const

export type PatternKey = (typeof PATTERN_KEYS)[number]

export function isPatternKey(value: string): value is PatternKey {
  return (PATTERN_KEYS as readonly string[]).includes(value)
}

export function patternStyle(pattern: PatternKey, ink: string, paper: string): SystemStyleObject {
  switch (pattern) {
    case 'geometric':
      return {
        backgroundColor: paper,
        backgroundImage: [
          `radial-gradient(25% 25% at 25% 25%, ${ink} 99%, transparent 101%)`,
          `radial-gradient(25% 25% at 25% 25%, ${ink} 99%, transparent 101%)`,
          `radial-gradient(50% 50%, ${paper} 98%, transparent)`,
          `repeating-conic-gradient(${paper} 0 25%, ${ink} 0 50%)`,
        ].join(', '),
        backgroundPosition: '50px 50px, 0 0, 0 0, 25px 0',
        backgroundSize: '100px 100px, 100px 100px, 50px 50px, 100px 50px',
      }
    case 'lines':
      return {
        backgroundColor: paper,
        backgroundImage: `repeating-linear-gradient(0deg, ${ink}, ${ink} 1px, ${paper} 1px, ${paper})`,
        backgroundSize: '20px 20px',
      }
    case 'scales':
      return {
        backgroundColor: paper,
        backgroundImage: [
          `radial-gradient(circle 23px at 20px 8px, ${ink} 23px, transparent 24px)`,
          `radial-gradient(circle 23px at 20px 32px, ${paper} 23px, transparent 24px)`,
          `linear-gradient(${paper} 50%, ${ink} 50%)`,
        ].join(', '),
        backgroundSize: '40px 40px',
        backgroundPosition: '0 0, 20px 0, 0 0',
      }
    case 'waves':
      return {
        backgroundColor: paper,
        backgroundImage: [
          `radial-gradient(circle at 50% 100%, transparent 20%, ${ink} 21%, ${ink} 34%, transparent 35%, transparent)`,
          `radial-gradient(circle at 50% 0%, transparent 20%, ${ink} 21%, ${ink} 34%, transparent 35%, transparent)`,
        ].join(', '),
        backgroundPosition: '0 0, -20px 0',
        backgroundSize: '40px 30px',
      }
    case 'dots':
      return {
        backgroundColor: paper,
        backgroundImage: `radial-gradient(${ink} 1.5px, transparent 1.5px), radial-gradient(${ink} 1.5px, ${paper} 1.5px)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 10px 10px',
      }
    case 'grid':
      return {
        backgroundColor: paper,
        backgroundImage: [
          `radial-gradient(circle, transparent 20%, ${paper} 20%, ${paper} 80%, transparent 80%, transparent)`,
          `radial-gradient(circle, transparent 20%, ${paper} 20%, ${paper} 80%, transparent 80%, transparent)`,
          `linear-gradient(${ink} 2px, transparent 2px)`,
          `linear-gradient(90deg, ${ink} 2px, ${paper} 2px)`,
        ].join(', '),
        backgroundPosition: '0 0, 25px 25px, 0 -1px, -1px 0',
        backgroundSize: '50px 50px, 50px 50px, 25px 25px, 25px 25px',
      }
  }
}
