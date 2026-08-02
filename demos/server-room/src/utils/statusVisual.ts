import type { ServerStatus } from '../types/server'

export const STATUS_VISUALS = {
  healthy: { label: '正常', color: '#22C55E' },
  critical: { label: '障害', color: '#EF4444' },
} as const satisfies Record<
  ServerStatus,
  { readonly label: string; readonly color: string }
>

export const SELECTED_EMISSIVE = '#38BDF8'
export const SELECTED_EMISSIVE_INTENSITY = 0.45
