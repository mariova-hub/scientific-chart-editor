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

export const STYLE_LIMITS = {
  minFontSizePx: 8,
  maxFontSizePx: 72,
  minMarkerSizePx: 2,
  maxMarkerSizePx: 48,
  minLineWidthPx: 0.5,
  maxLineWidthPx: 12,
  minBorderWidthPx: 0,
  maxBorderWidthPx: 12,
  minCapSizePx: 0,
  maxCapSizePx: 30,
  minTickLengthPx: 0,
  maxTickLengthPx: 30,
  minTickLineWidthPx: 0,
  maxTickLineWidthPx: 12,
  minLabelAngleDeg: -180,
  maxLabelAngleDeg: 180,
  minAxisTextDistancePx: 0,
  maxAxisTextDistancePx: 100,
  minDecimalPlaces: 0,
  maxDecimalPlaces: 10,
  minMarginPx: 0,
  maxMarginPx: 500,
  minPlotWidthPx: 100,
  minPlotHeightPx: 100,
} as const
