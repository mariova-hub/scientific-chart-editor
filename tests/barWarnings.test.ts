import { describe, expect, it } from 'vitest'
import { getProjectWarnings } from '../src/model/projectValidation'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject } from './helpers'

describe('bar chart warnings', () => {
  it('warns without changing a non-zero value-axis minimum', () => {
    let project = sampleBarProject()
    const valueAxisId = project.chart.axes.find((axis) => axis.dimension === 'y')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: valueAxisId,
      bound: 'minimum',
      value: 1,
    })
    expect(getProjectWarnings(project)).toMatchObject([
      { code: 'bar.baseline.nonzero' },
    ])
    expect(
      project.chart.axes.find((axis) => axis.id === valueAxisId)?.scale.minimum,
    ).toBe(1)
  })

  it('uses X as the value axis after horizontal orientation', () => {
    let project = sampleBarProject()
    project = projectReducer(project, {
      type: 'set-bar-orientation',
      value: 'horizontal',
    })
    const xAxisId = project.chart.axes.find((axis) => axis.dimension === 'x')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: xAxisId,
      bound: 'minimum',
      value: 0.5,
    })
    expect(getProjectWarnings(project)[0]?.path).toContain(xAxisId)
  })
})
