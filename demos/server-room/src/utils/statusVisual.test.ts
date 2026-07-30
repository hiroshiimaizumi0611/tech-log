import { describe, expect, it } from 'vitest'

import type { ServerStatus } from '../types/server'
import {
  SELECTED_EMISSIVE,
  SELECTED_EMISSIVE_INTENSITY,
  STATUS_VISUALS,
} from './statusVisual'

describe('status visuals', () => {
  it('maps every server status to its exact label and color', () => {
    const expected = {
      healthy: { label: '正常', color: '#22C55E' },
      critical: { label: '障害', color: '#EF4444' },
    } as const satisfies Record<
      ServerStatus,
      { readonly label: string; readonly color: string }
    >

    expect(STATUS_VISUALS).toEqual(expected)
    expect(Object.keys(STATUS_VISUALS)).toEqual(['healthy', 'critical'])
  })

  it('uses the exact selected emissive styling', () => {
    expect(SELECTED_EMISSIVE).toBe('#38BDF8')
    expect(SELECTED_EMISSIVE_INTENSITY).toBe(0.45)
  })
})
