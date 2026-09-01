import { describe, expect, it } from 'vitest'
import { isNumericAxis } from '../src/model/dataBinding'
import {
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { prepareProjectAction } from '../src/state/projectActionGuard'
import { projectReducer, type ProjectAction } from '../src/state/projectReducer'
import { sampleBarProject, sampleProject } from './helpers'

function axisId(project: ReturnType<typeof sampleProject>, dimension: 'x' | 'y') {
  return project.chart.axes.find((axis) => axis.dimension === dimension)!.id
}

function apply(
  project: ReturnType<typeof sampleProject>,
  action: ProjectAction,
) {
  const prepared = prepareProjectAction(project, action)
  return prepared.ok ? prepared.candidate : project
}

describe('numeric axis range settings', () => {
  it('maps independent scatter X and Y bounds and units', () => {
    let project = sampleProject()
    const xAxisId = axisId(project, 'x')
    const yAxisId = axisId(project, 'y')
    const actions: ProjectAction[] = [
      { type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: 2 },
      { type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: 8 },
      { type: 'set-axis-major-unit', axisId: xAxisId, value: 1 },
      { type: 'set-axis-minor-unit', axisId: xAxisId, value: 0.5 },
      { type: 'set-axis-bound', axisId: yAxisId, bound: 'minimum', value: 1 },
      { type: 'set-axis-bound', axisId: yAxisId, bound: 'maximum', value: 3 },
      { type: 'set-axis-major-unit', axisId: yAxisId, value: 0.25 },
      { type: 'set-axis-minor-unit', axisId: yAxisId, value: 0.125 },
    ]
    for (const action of actions) project = apply(project, action)

    const figure = toPlotlyFigure(project)
    expect(figure.layout.xaxis).toMatchObject({
      range: [2, 8],
      dtick: 1,
      minor: { dtick: 0.5 },
    })
    expect(figure.layout.yaxis).toMatchObject({
      range: [1, 3],
      dtick: 0.25,
      minor: { dtick: 0.125 },
    })
  })

  it('returns each bound and unit to Auto independently', () => {
    let project = sampleProject()
    const xAxisId = axisId(project, 'x')
    project = apply(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: 2,
    })
    project = apply(project, {
      type: 'set-axis-major-unit', axisId: xAxisId, value: 1,
    })
    project = apply(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: 8,
    })
    project = apply(project, {
      type: 'set-axis-minor-unit', axisId: xAxisId, value: 0.5,
    })
    project = apply(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: null,
    })
    project = apply(project, {
      type: 'set-axis-major-unit', axisId: xAxisId, value: null,
    })
    project = apply(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: null,
    })
    project = apply(project, {
      type: 'set-axis-minor-unit', axisId: xAxisId, value: null,
    })

    const xAxis = project.chart.axes.find((axis) => axis.id === xAxisId)!
    expect(xAxis.scale.minimum).toBeNull()
    expect(xAxis.scale.maximum).toBeNull()
    expect(xAxis.ticks.majorInterval).toEqual({ mode: 'auto' })
    expect(xAxis.ticks.minorInterval).toEqual({ mode: 'auto' })
    const plotlyAxis = toPlotlyFigure(project).layout.xaxis
    expect(plotlyAxis).toMatchObject({ autorange: true })
    expect(plotlyAxis?.range).toBeUndefined()
    expect(plotlyAxis?.dtick).toBeUndefined()
    expect(plotlyAxis?.minor?.dtick).toBeUndefined()
  })

  it('rejects min >= max and keeps the previous model', () => {
    let project = sampleProject()
    const xAxisId = axisId(project, 'x')
    project = apply(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: 8,
    })
    const before = project
    const prepared = prepareProjectAction(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: 8,
    })

    expect(prepared).toMatchObject({
      ok: false,
      issue: { code: 'axis.range', message: expect.stringContaining('最小値') },
    })
    expect(project).toBe(before)
    expect(project.chart.axes.find((axis) => axis.id === xAxisId)?.scale.minimum).toBeNull()
  })

  it.each([
    ['set-axis-major-unit', 'axis.majorUnit'],
    ['set-axis-minor-unit', 'axis.minorUnit'],
  ] as const)('rejects a non-positive %s', (type, code) => {
    const project = sampleProject()
    const prepared = prepareProjectAction(project, {
      type,
      axisId: axisId(project, 'x'),
      value: 0,
    })
    expect(prepared).toMatchObject({ ok: false, issue: { code } })
    expect(project.chart.axes[0].ticks.majorInterval).toEqual({ mode: 'auto' })
    expect(project.chart.axes[0].ticks.minorInterval).toEqual({ mode: 'none' })
  })

  it('rejects non-finite values before they can enter the model', () => {
    const project = sampleProject()
    const prepared = prepareProjectAction(project, {
      type: 'set-axis-bound',
      axisId: axisId(project, 'x'),
      bound: 'minimum',
      value: Number.POSITIVE_INFINITY,
    })
    expect(prepared).toMatchObject({ ok: false, issue: { code: 'axis.minimum' } })
  })

  it.each([0, -1])('rejects a %s fixed bound on a log axis', (value) => {
    let project = sampleProject()
    const xAxisId = axisId(project, 'x')
    project = projectReducer(project, {
      type: 'set-axis-scale-type', axisId: xAxisId, value: 'log',
    })
    const prepared = prepareProjectAction(project, {
      type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value,
    })
    expect(prepared).toMatchObject({
      ok: false,
      issue: { code: 'axis.log.minimum' },
    })
  })
})

describe('numeric and category axes by chart orientation', () => {
  it('exposes only Y as numeric for a vertical bar chart', () => {
    const project = sampleBarProject()
    expect(isNumericAxis(project, 'x')).toBe(false)
    expect(isNumericAxis(project, 'y')).toBe(true)
  })

  it('exposes only X as numeric for a horizontal bar chart', () => {
    let project = sampleBarProject()
    project = projectReducer(project, {
      type: 'set-bar-orientation', value: 'horizontal',
    })
    expect(isNumericAxis(project, 'x')).toBe(true)
    expect(isNumericAxis(project, 'y')).toBe(false)
  })
})

describe('axis range persistence', () => {
  it('round-trips both axes including fixed and Auto states', () => {
    let project = sampleProject()
    const xAxisId = axisId(project, 'x')
    const yAxisId = axisId(project, 'y')
    const actions: ProjectAction[] = [
      { type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: 2 },
      { type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: 8 },
      { type: 'set-axis-major-unit', axisId: xAxisId, value: 1 },
      { type: 'set-axis-minor-unit', axisId: xAxisId, value: 0.5 },
      { type: 'set-axis-bound', axisId: yAxisId, bound: 'minimum', value: 1 },
      { type: 'set-axis-bound', axisId: yAxisId, bound: 'maximum', value: 3 },
      { type: 'set-axis-major-unit', axisId: yAxisId, value: null },
      { type: 'set-axis-minor-unit', axisId: yAxisId, value: 0.125 },
    ]
    for (const action of actions) project = apply(project, action)

    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(project)
  })
})
