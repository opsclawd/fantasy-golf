import { describe, expect, it } from 'vitest'

import {
  metricCardClasses,
  pageShellClasses,
  panelClasses,
  scrollRegionFocusClasses,
  sectionHeadingClasses,
} from '../uiStyles'

describe('uiStyles', () => {
  it('returns the gradient shell for upgraded app pages', () => {
    expect(pageShellClasses()).toContain('bg-[radial-gradient(')
  })

  it('returns the premium panel classes for default panels', () => {
    expect(panelClasses()).toContain('rounded-3xl')
    expect(panelClasses()).toContain('border-white/60')
  })

  it('returns metric card classes with compact hierarchy', () => {
    expect(metricCardClasses()).toContain('min-h-[8rem]')
  })

  it('returns the shared heading wrapper classes', () => {
    expect(sectionHeadingClasses()).toContain('tracking-[0.18em]')
  })

  it('returns visible focus classes for keyboard-scroll regions', () => {
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-inset')
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-2')
    expect(scrollRegionFocusClasses()).toContain('focus-visible:ring-emerald-500')
    expect(scrollRegionFocusClasses()).not.toContain('focus-visible:ring-offset-2')
    expect(scrollRegionFocusClasses()).not.toBe('focus-visible:outline-none')
  })
})
