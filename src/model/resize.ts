import { CHART_SIZE_LIMITS } from './limits'

export interface ChartSize {
  widthPx: number
  heightPx: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateResizedChartSize(
  start: ChartSize,
  deltaX: number,
  deltaY: number,
): ChartSize {
  return {
    widthPx: clamp(
      Math.round(start.widthPx + deltaX),
      CHART_SIZE_LIMITS.minWidthPx,
      CHART_SIZE_LIMITS.maxWidthPx,
    ),
    heightPx: clamp(
      Math.round(start.heightPx + deltaY),
      CHART_SIZE_LIMITS.minHeightPx,
      CHART_SIZE_LIMITS.maxHeightPx,
    ),
  }
}
