export const DATA_LIMITS = {
  maxColumns: 256,
  maxRows: 10_000,
  maxProjectFileBytes: 5 * 1024 * 1024,
} as const

export const CHART_SIZE_LIMITS = {
  minWidthPx: 360,
  maxWidthPx: 1600,
  minHeightPx: 300,
  maxHeightPx: 1200,
} as const
