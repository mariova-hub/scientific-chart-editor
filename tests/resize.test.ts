import { describe, expect, it } from 'vitest'
import { calculateResizedChartSize } from '../src/model/resize'

describe('chart resize calculation', () => {
  it('adds pointer deltas and rounds to integer pixels', () => {
    expect(calculateResizedChartSize({ widthPx: 760, heightPx: 480 }, 40.4, 19.6)).toEqual({
      widthPx: 800,
      heightPx: 500,
    })
  })

  it('clamps the preview to the Phase 1 size limits', () => {
    expect(calculateResizedChartSize({ widthPx: 760, heightPx: 480 }, -1000, 2000)).toEqual({
      widthPx: 360,
      heightPx: 1200,
    })
  })
})
