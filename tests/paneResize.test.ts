import { describe, expect, it } from 'vitest'
import { calculateDataPaneWidth } from '../src/model/paneResize'

describe('data pane resize calculation', () => {
  it('adds pointer delta and rounds to integer pixels', () => {
    expect(calculateDataPaneWidth(360, 40.4)).toBe(400)
  })

  it('clamps the data pane to its safe range', () => {
    expect(calculateDataPaneWidth(360, -1000)).toBe(320)
    expect(calculateDataPaneWidth(360, 1000)).toBe(720)
  })
})
