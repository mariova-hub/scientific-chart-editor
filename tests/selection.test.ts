import { describe, expect, it } from 'vitest'
import {
  defaultSelection,
  selectionFromKey,
  selectionKey,
} from '../src/state/selection'
import { sampleProject } from './helpers'

describe('chart selection', () => {
  it('round-trips stable axis and series IDs through the selector key', () => {
    const project = sampleProject()
    const selections = [
      { type: 'axis', axisId: project.chart.axes[0].id } as const,
      { type: 'series', seriesId: project.chart.series[0].id } as const,
      { type: 'error-bars', seriesId: project.chart.series[0].id, direction: 'y' } as const,
    ]
    for (const selection of selections) {
      expect(selectionFromKey(project, selectionKey(selection))).toEqual(selection)
    }
  })

  it('falls back to chart selection for a stale ID', () => {
    const project = sampleProject()
    expect(selectionFromKey(project, 'axis:missing')).toEqual(defaultSelection(project))
  })
})
