import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../tailwind.config.js'

const colors = tailwindConfig.theme.extend.colors
const spacing = tailwindConfig.theme.extend.spacing

describe('tailwind config color tokens', () => {
  it('defines primary color tokens', () => {
    expect(colors.primary[900]).toBe('#14532d')
    expect(colors.primary[700]).toBe('#15803d')
    expect(colors.primary[100]).toBe('#dcfce7')
  })

  it('defines surface color tokens', () => {
    expect(colors.surface.warm).toBe('#fef3c7')
    expect(colors.surface.base).toBe('#fffbeb')
  })

  it('defines action color tokens', () => {
    expect(colors.action.warning).toBe('#f59e0b')
    expect(colors.action.error).toBe('#dc2626')
  })

  it('defines neutral color tokens', () => {
    expect(colors.neutral[900]).toBe('#1c1917')
    expect(colors.neutral[600]).toBe('#57534e')
    expect(colors.neutral[200]).toBe('#e7e5e4')
  })
})

describe('tailwind config spacing tokens', () => {
  it('defines 8px-base rhythm spacing', () => {
    expect(spacing['1x']).toBe('0.5rem')
    expect(spacing['2x']).toBe('1rem')
    expect(spacing['3x']).toBe('1.5rem')
    expect(spacing['4x']).toBe('2rem')
    expect(spacing['6x']).toBe('3rem')
  })
})

describe('tailwind config typography tokens', () => {
  it('defines label font size', () => {
    const fontSize = tailwindConfig.theme.extend.fontSize
    expect(fontSize.label[0]).toBe('0.875rem')
  })

  it('defines sans font family with Inter first', () => {
    const fontFamily = tailwindConfig.theme.extend.fontFamily
    expect(fontFamily.sans[0]).toBe('Inter')
  })

  it('defines mono font family', () => {
    const fontFamily = tailwindConfig.theme.extend.fontFamily
    expect(fontFamily.mono).toBeDefined()
  })
})
