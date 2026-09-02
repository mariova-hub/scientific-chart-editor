import { describe, expect, it } from 'vitest'
import {
  toPlotlyFigure,
  toPlotlyViewResetLayout,
} from '../src/renderer/plotly/plotlyAdapter'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sampleProject } from './helpers'

function projectWithFixedAxes() {
  let project = sampleProject()
  const xAxisId = project.chart.axes.find(
    (axis) => axis.dimension === 'x',
  )!.id
  const yAxisId = project.chart.axes.find(
    (axis) => axis.dimension === 'y',
  )!.id
  const actions = [
    { type: 'set-axis-bound', axisId: xAxisId, bound: 'minimum', value: 0 },
    { type: 'set-axis-bound', axisId: xAxisId, bound: 'maximum', value: 10 },
    { type: 'set-axis-bound', axisId: yAxisId, bound: 'minimum', value: 0 },
    { type: 'set-axis-bound', axisId: yAxisId, bound: 'maximum', value: 500 },
  ] as const
  for (const action of actions) project = projectReducer(project, action)
  return project
}

describe('Plotly temporary view reset', () => {
  it('restores fixed axis ranges from the Chart Model', () => {
    const reset = toPlotlyViewResetLayout(projectWithFixedAxes())

    expect(reset.xaxis).toMatchObject({ autorange: false, range: [0, 10] })
    expect(reset.yaxis).toMatchObject({ autorange: false, range: [0, 500] })
  })

  it('restores Auto axes with autorange', () => {
    const reset = toPlotlyViewResetLayout(sampleProject())

    expect(reset.xaxis).toMatchObject({ autorange: true })
    expect(reset.yaxis).toMatchObject({ autorange: true })
    expect(reset.xaxis?.range).toBeUndefined()
    expect(reset.yaxis?.range).toBeUndefined()
  })

  it('keeps the bar category axis categorical', () => {
    const reset = toPlotlyViewResetLayout(sampleBarProject())

    expect(reset.xaxis).toMatchObject({ type: 'category', autorange: true })
    expect(reset.xaxis?.range).toBeUndefined()
  })

  it('does not mutate Project State', () => {
    const project = projectWithFixedAxes()
    const before = structuredClone(project)

    toPlotlyViewResetLayout(project)

    expect(project).toEqual(before)
  })

  it('keeps temporary view ranges out of export figures', () => {
    const project = projectWithFixedAxes()
    const temporaryView = toPlotlyViewResetLayout(project)
    temporaryView.xaxis!.range = [2, 4]
    temporaryView.yaxis!.range = [100, 200]

    const exportedFigure = toPlotlyFigure(project)

    expect(temporaryView.xaxis?.range).toEqual([2, 4])
    expect(temporaryView.yaxis?.range).toEqual([100, 200])
    expect(exportedFigure.layout.xaxis?.range).toEqual([0, 10])
    expect(exportedFigure.layout.yaxis?.range).toEqual([0, 500])
  })
})
