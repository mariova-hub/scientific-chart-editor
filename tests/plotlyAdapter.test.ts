import { describe, expect, it } from 'vitest'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { projectReducer } from '../src/state/projectReducer'
import { sampleProject } from './helpers'

describe('Plotly adapter', () => {
  it('maps X, Y, and per-point symmetric Y errors', () => {
    const figure = toPlotlyFigure(sampleProject())
    expect(figure.data[0]).toMatchObject({
      type: 'scatter',
      mode: 'markers',
      x: [3, 4, 5, 6, 7],
      y: [1.24, 1.51, 1.83, 2.1, 2.31],
      error_y: {
        symmetric: true,
        array: [0.08, 0.12, 0.05, 0.14, 0.09],
      },
    })
  })

  it('omits the entire error_y object when one drawable point has an invalid error', () => {
    const project = sampleProject('X\tY\tE\n1\t2\t0.1\n2\t3\tbad\n3\t4\t0.3')
    const figure = toPlotlyFigure(project)
    expect(figure.data[0]).toMatchObject({
      x: [1, 2, 3],
      y: [2, 3, 4],
    })
    expect(figure.data[0]).not.toHaveProperty('error_y')
  })

  it('keeps a valid zero in the Plotly error array', () => {
    const project = sampleProject('X\tY\tE\n1\t2\t0\n2\t3\t0.2')
    const figure = toPlotlyFigure(project)
    expect(figure.data[0]).toMatchObject({
      error_y: { array: [0, 0.2], symmetric: true },
    })
  })

  it('maps axis minimum, maximum, and majorUnit', () => {
    let project = sampleProject()
    project = projectReducer(project, {
      type: 'set-axis-bound',
      dimension: 'x',
      bound: 'minimum',
      value: 2,
    })
    project = projectReducer(project, {
      type: 'set-axis-bound',
      dimension: 'x',
      bound: 'maximum',
      value: 8,
    })
    project = projectReducer(project, {
      type: 'set-axis-major-unit',
      dimension: 'x',
      value: 1,
    })
    const figure = toPlotlyFigure(project)
    expect(figure.layout.xaxis).toMatchObject({
      autorange: false,
      range: [2, 8],
      dtick: 1,
    })
  })

  it('maps one explicit bound against the derived data extent', () => {
    let project = sampleProject()
    project = projectReducer(project, {
      type: 'set-axis-bound',
      dimension: 'y',
      bound: 'minimum',
      value: 0,
    })
    const figure = toPlotlyFigure(project)
    expect(figure.layout.yaxis?.range?.[0]).toBe(0)
    expect(Number(figure.layout.yaxis?.range?.[1])).toBeCloseTo(2.4)
  })

  it('maps chart title and dimensions without writing Plotly data into the model', () => {
    const project = sampleProject()
    const before = structuredClone(project)
    const figure = toPlotlyFigure(project)
    expect(figure.layout).toMatchObject({ width: 760, height: 480 })
    expect(figure.layout.title).toMatchObject({ text: 'Scientific chart' })
    expect(figure.config.displayModeBar).toBe(false)
    expect(project).toEqual(before)
  })
})
