import { describe, expect, it } from 'vitest'
import { validateLogAxes } from '../src/model/axisValidation'
import { projectReducer } from '../src/state/projectReducer'
import { sampleProject } from './helpers'

describe('log axis validation', () => {
  it('accepts a positive dataset and positive explicit range', () => {
    let project = sampleProject()
    const axisId = project.chart.axes[0].id
    project = projectReducer(project, { type: 'set-axis-bound', axisId, bound: 'minimum', value: 1 })
    project = projectReducer(project, { type: 'set-axis-scale-type', axisId, value: 'log' })
    expect(validateLogAxes(project)).toEqual([])
  })

  it('explains how many drawable values prevent log scale', () => {
    let project = sampleProject('X\tY\tE\n0\t2\t0.1\n-1\t3\t0.2\n4\t5\t0.3')
    const axisId = project.chart.axes[0].id
    project = projectReducer(project, { type: 'set-axis-scale-type', axisId, value: 'log' })
    expect(validateLogAxes(project)).toMatchObject([
      { code: 'axis.log.data', message: expect.stringContaining('2件') },
    ])
  })

  it('rejects a Y error extent that reaches zero on a log axis', () => {
    let project = sampleProject('X\tY\tE\n1\t0.2\t0.2\n2\t3\t0.1')
    const axisId = project.chart.axes[1].id
    project = projectReducer(project, { type: 'set-axis-scale-type', axisId, value: 'log' })
    expect(validateLogAxes(project)).toMatchObject([
      { code: 'axis.log.data', message: expect.stringContaining('1件') },
    ])
  })
})
