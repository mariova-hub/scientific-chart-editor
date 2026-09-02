export const BAR_GAP_PERCENT_LIMITS = {
  minimum: 0,
  maximum: 500,
} as const

export const DEFAULT_BAR_GAP_PERCENT = 150
export const LEGACY_DEFAULT_BAR_GAP_PERCENT = 25

export function isValidBarGapPercent(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= BAR_GAP_PERCENT_LIMITS.minimum &&
    value <= BAR_GAP_PERCENT_LIMITS.maximum
  )
}

export function barGapPercentToPlotlyGap(value: number): number {
  return value / (100 + value)
}

export function legacyBarWidthRatioToGapPercent(value: number): number {
  const converted = ((1 - value) / value) * 100
  return normalizeLegacyGapPercent(converted)
}

export function legacyPlotlyGapToGapPercent(value: number): number {
  const converted = (value / (1 - value)) * 100
  return normalizeLegacyGapPercent(converted)
}

function normalizeLegacyGapPercent(value: number): number {
  const bounded = Math.min(
    BAR_GAP_PERCENT_LIMITS.maximum,
    Math.max(BAR_GAP_PERCENT_LIMITS.minimum, value),
  )
  return Math.round(bounded * 1_000_000) / 1_000_000
}
