export const DATA_PANE_LIMITS = {
  minimumPx: 320,
  maximumPx: 720,
} as const

export function calculateDataPaneWidth(
  startWidthPx: number,
  pointerDeltaPx: number,
): number {
  return Math.min(
    DATA_PANE_LIMITS.maximumPx,
    Math.max(
      DATA_PANE_LIMITS.minimumPx,
      Math.round(startWidthPx + pointerDeltaPx),
    ),
  )
}
