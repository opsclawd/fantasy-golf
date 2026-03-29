import { describe, expect, it } from 'vitest'

import { getDataAlertLiveRegion } from '../data-alert-a11y'

describe('getDataAlertLiveRegion', () => {
  it('returns assertive alert semantics for error', () => {
    expect(getDataAlertLiveRegion('error')).toEqual({ role: 'alert' })
  })

  it('returns polite status semantics for warning and info', () => {
    expect(getDataAlertLiveRegion('warning')).toEqual({
      role: 'status',
      'aria-live': 'polite',
    })
    expect(getDataAlertLiveRegion('info')).toEqual({
      role: 'status',
      'aria-live': 'polite',
    })
  })
})
