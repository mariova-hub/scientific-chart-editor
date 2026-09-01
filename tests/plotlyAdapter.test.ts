import { describe, expect, it } from 'vitest'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sampleProject } from './helpers'

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
    const xAxisId = project.chart.axes.find((axis) => axis.dimension === 'x')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: xAxisId,
      bound: 'minimum',
      value: 2,
    })
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: xAxisId,
      bound: 'maximum',
      value: 8,
    })
    project = projectReducer(project, {
      type: 'set-axis-major-unit',
      axisId: xAxisId,
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
    const yAxisId = project.chart.axes.find((axis) => axis.dimension === 'y')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: yAxisId,
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

  it('maps minorUnit, log, reversed, ticks, grids, axis line, and labels', () => {
    let project = sampleProject()
    const axisId = project.chart.axes.find((axis) => axis.dimension === 'x')!.id
    const actions = [
      { type: 'set-axis-bound', axisId, bound: 'minimum', value: 1 },
      { type: 'set-axis-bound', axisId, bound: 'maximum', value: 10 },
      { type: 'set-axis-scale-type', axisId, value: 'log' },
      { type: 'set-axis-reversed', axisId, value: true },
      { type: 'set-axis-minor-unit', axisId, value: 0.1 },
      { type: 'set-axis-tick-visible', axisId, kind: 'minor', visible: true },
      { type: 'set-axis-tick-direction', axisId, value: 'cross' },
      { type: 'set-axis-grid-visible', axisId, kind: 'major', visible: false },
      { type: 'set-axis-grid-visible', axisId, kind: 'minor', visible: true },
      { type: 'set-axis-line', axisId, field: 'color', value: '#123456' },
      { type: 'set-axis-line', axisId, field: 'widthPx', value: 3 },
      { type: 'set-axis-label-style', axisId, field: 'family', value: 'Georgia' },
      { type: 'set-axis-label-style', axisId, field: 'sizePx', value: 15 },
    ] as const
    for (const action of actions) project = projectReducer(project, action)

    expect(toPlotlyFigure(project).layout.xaxis).toMatchObject({
      type: 'log',
      autorange: false,
      range: [1, 0],
      ticks: 'inside',
      ticklen: 6,
      showgrid: false,
      showline: true,
      linecolor: '#123456',
      linewidth: 3,
      tickfont: { family: 'Georgia', size: 15 },
      minor: { dtick: 0.1, ticks: 'inside', showgrid: true, ticklen: 3 },
    })
  })

  it('maps marker and renderer-neutral line styles', () => {
    let project = sampleProject()
    const seriesId = project.chart.series[0].id
    const actions = [
      { type: 'set-series-marker', seriesId, field: 'shape', value: 'diamond' },
      { type: 'set-series-marker', seriesId, field: 'sizePx', value: 14 },
      { type: 'set-series-marker', seriesId, field: 'fillColor', value: '#112233' },
      { type: 'set-series-marker', seriesId, field: 'borderColor', value: '#445566' },
      { type: 'set-series-marker', seriesId, field: 'borderWidthPx', value: 2 },
      { type: 'set-series-line', seriesId, field: 'visible', value: true },
      { type: 'set-series-line', seriesId, field: 'color', value: '#778899' },
      { type: 'set-series-line', seriesId, field: 'widthPx', value: 4 },
      { type: 'set-series-line', seriesId, field: 'dash', value: 'dash-dot' },
    ] as const
    for (const action of actions) project = projectReducer(project, action)

    expect(toPlotlyFigure(project).data[0]).toMatchObject({
      mode: 'lines+markers',
      marker: {
        symbol: 'diamond',
        size: 14,
        color: '#112233',
        line: { color: '#445566', width: 2 },
      },
      line: { color: '#778899', width: 4, dash: 'dashdot' },
    })
  })

  it('maps error bar style but never bypasses invalid-error suppression', () => {
    let project = sampleProject()
    const seriesId = project.chart.series[0].id
    project = projectReducer(project, { type: 'set-error-bar-style', seriesId, field: 'color', value: '#aa3377' })
    project = projectReducer(project, { type: 'set-error-bar-style', seriesId, field: 'widthPx', value: 3 })
    project = projectReducer(project, { type: 'set-error-bar-style', seriesId, field: 'capSizePx', value: 9 })
    expect(toPlotlyFigure(project).data[0]).toMatchObject({
      error_y: { color: '#aa3377', thickness: 3, width: 9 },
    })

    const errorColumnId = project.datasets[0].columns[2].id
    project.datasets[0].rows[0].cells[errorColumnId] = 'bad'
    expect(toPlotlyFigure(project).data[0]).not.toHaveProperty('error_y')
  })

  it('maps legend positions and chart/title appearance without Plotly values in the model', () => {
    let project = sampleProject()
    project = projectReducer(project, { type: 'set-legend-visible', value: true })
    project = projectReducer(project, { type: 'set-legend-position', value: 'top' })
    project = projectReducer(project, { type: 'set-chart-background', field: 'backgroundColor', value: '#f0f1f2' })
    project = projectReducer(project, { type: 'set-chart-background', field: 'plotBackgroundColor', value: '#fafafa' })
    project = projectReducer(project, { type: 'set-chart-title-style', field: 'bold', value: true })
    const figure = toPlotlyFigure(project)
    expect(figure.layout).toMatchObject({
      showlegend: true,
      legend: { x: 0.5, y: 1.12, orientation: 'h' },
      paper_bgcolor: '#f0f1f2',
      plot_bgcolor: '#fafafa',
      title: { text: '<b>Scientific chart</b>' },
    })
  })

  it('maps semantic bar bindings to a vertical trace and Y errors', () => {
    const figure = toPlotlyFigure(sampleBarProject())
    expect(figure.data[0]).toMatchObject({
      type: 'bar',
      orientation: 'v',
      x: [3, 4, 5, 6, 7],
      y: [1.24, 1.51, 1.83, 2.1, 2.31],
      error_y: { array: [0.08, 0.12, 0.05, 0.14, 0.09] },
    })
    expect(figure.data[0]).not.toHaveProperty('error_x')
  })

  it('maps the same bindings to a horizontal trace and X errors', () => {
    let project = sampleBarProject()
    const bindings = structuredClone(project.chart.series[0].barBindings)
    project = projectReducer(project, {
      type: 'set-bar-orientation',
      value: 'horizontal',
    })
    const figure = toPlotlyFigure(project)
    expect(figure.data[0]).toMatchObject({
      type: 'bar',
      orientation: 'h',
      x: [1.24, 1.51, 1.83, 2.1, 2.31],
      y: [3, 4, 5, 6, 7],
      error_x: { array: [0.08, 0.12, 0.05, 0.14, 0.09] },
    })
    expect(project.chart.series[0].barBindings).toEqual(bindings)
  })

  it('suppresses the full bar error object when one error is invalid', () => {
    const project = sampleBarProject(
      'カテゴリ\t値\t誤差\nA\t1\t0.1\nB\t2\tbad',
    )
    const figure = toPlotlyFigure(project)
    expect(figure.data[0]).toMatchObject({ x: ['A', 'B'], y: [1, 2] })
    expect(figure.data[0]).not.toHaveProperty('error_y')
  })

  it('maps renderer-neutral bar style and gap', () => {
    let project = sampleBarProject()
    const seriesId = project.chart.series[0].id
    const actions = [
      { type: 'set-series-bar', seriesId, field: 'fillColor', value: '#112233' },
      { type: 'set-series-bar', seriesId, field: 'borderColor', value: '#445566' },
      { type: 'set-series-bar', seriesId, field: 'borderWidthPx', value: 3 },
      { type: 'set-series-bar', seriesId, field: 'opacity', value: 0.7 },
      { type: 'set-series-bar', seriesId, field: 'widthRatio', value: 0.6 },
      { type: 'set-bar-gap', value: 0.35 },
    ] as const
    for (const action of actions) project = projectReducer(project, action)
    const figure = toPlotlyFigure(project)
    expect(figure.data[0]).toMatchObject({
      marker: { color: '#112233', line: { color: '#445566', width: 3 } },
      opacity: 0.7,
      width: 0.6,
    })
    expect(figure.layout.bargap).toBe(0.35)
  })

  it('uses a category axis without numeric-only settings', () => {
    let project = sampleBarProject()
    const categoryAxisId = project.chart.axes.find((axis) => axis.dimension === 'x')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: categoryAxisId,
      bound: 'minimum',
      value: 1,
    })
    project = projectReducer(project, {
      type: 'set-axis-major-unit',
      axisId: categoryAxisId,
      value: 2,
    })
    project = projectReducer(project, {
      type: 'set-axis-scale-type',
      axisId: categoryAxisId,
      value: 'log',
    })
    expect(toPlotlyFigure(project).layout.xaxis).toMatchObject({
      type: 'category',
      autorange: true,
    })
    expect(toPlotlyFigure(project).layout.xaxis).not.toHaveProperty('range')
    expect(toPlotlyFigure(project).layout.xaxis).not.toHaveProperty('dtick')
  })
})
