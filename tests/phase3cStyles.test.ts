import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProjectFile } from '../src/persistence/projectFile'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { prepareProjectAction } from '../src/state/projectActionGuard'
import { projectReducer, type ProjectAction } from '../src/state/projectReducer'
import type { ProjectState } from '../src/model/types'
import { sampleBarProject, sampleProject } from './helpers'

function reduce(project: ProjectState, actions: ProjectAction[]): ProjectState {
  return actions.reduce(projectReducer, project)
}

describe('Phase 3C axis and plot-area styles', () => {
  it('maps independent major/minor tick visibility, direction, length, and width', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const changed = reduce(project, [
      { type: 'set-axis-tick-visible', axisId, kind: 'major', visible: true },
      { type: 'set-axis-tick-visible', axisId, kind: 'minor', visible: true },
      { type: 'set-axis-tick-direction', axisId, value: 'outside' },
      { type: 'set-axis-tick-style', axisId, field: 'majorLengthPx', value: 8 },
      { type: 'set-axis-tick-style', axisId, field: 'minorLengthPx', value: 4 },
      { type: 'set-axis-tick-style', axisId, field: 'lineWidthPx', value: 2 },
    ])

    expect(toPlotlyFigure(changed).layout.xaxis).toMatchObject({
      ticks: 'outside',
      ticklen: 8,
      tickwidth: 2,
      minor: { ticks: 'outside', ticklen: 4, tickwidth: 2 },
    })
  })

  it('maps tick-label visibility, font, bold, and angle', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const changed = reduce(project, [
      { type: 'set-axis-label-style', axisId, field: 'visible', value: false },
      { type: 'set-axis-label-style', axisId, field: 'family', value: 'Georgia' },
      { type: 'set-axis-label-style', axisId, field: 'sizePx', value: 16 },
      { type: 'set-axis-label-style', axisId, field: 'color', value: '#123456' },
      { type: 'set-axis-label-style', axisId, field: 'bold', value: true },
      { type: 'set-axis-label-style', axisId, field: 'angleDeg', value: 45 },
    ])

    expect(toPlotlyFigure(changed).layout.xaxis).toMatchObject({
      showticklabels: false,
      tickangle: 45,
      tickfont: {
        family: 'Georgia',
        size: 16,
        color: '#123456',
        weight: 'bold',
      },
    })
  })

  it.each([
    [{ kind: 'auto' } as const, undefined],
    [{ kind: 'integer' } as const, '.0f'],
    [{ kind: 'decimal', decimalPlaces: 2 } as const, '.2f'],
    [{ kind: 'scientific', decimalPlaces: 1 } as const, '.1e'],
  ])('maps number format %o to Plotly tickformat %s', (format, expected) => {
    const project = sampleProject()
    project.chart.axes[0].numberFormat = format
    expect(toPlotlyFigure(project).layout.xaxis?.tickformat).toBe(expected)
  })

  it('maps independent major/minor grid appearances', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const changed = reduce(project, [
      { type: 'set-axis-grid-visible', axisId, kind: 'minor', visible: true },
      { type: 'set-axis-grid-style', axisId, kind: 'major', field: 'color', value: '#112233' },
      { type: 'set-axis-grid-style', axisId, kind: 'major', field: 'widthPx', value: 2 },
      { type: 'set-axis-grid-style', axisId, kind: 'major', field: 'style', value: 'dash' },
      { type: 'set-axis-grid-style', axisId, kind: 'minor', field: 'color', value: '#445566' },
      { type: 'set-axis-grid-style', axisId, kind: 'minor', field: 'widthPx', value: 0.75 },
      { type: 'set-axis-grid-style', axisId, kind: 'minor', field: 'style', value: 'dot' },
    ])
    expect(toPlotlyFigure(changed).layout.xaxis).toMatchObject({
      gridcolor: '#112233',
      gridwidth: 2,
      griddash: 'dash',
      minor: {
        showgrid: true,
        gridcolor: '#445566',
        gridwidth: 0.75,
        griddash: 'dot',
      },
    })
  })

  it('maps axis-title visibility and semantic font style', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const changed = reduce(project, [
      { type: 'set-axis-title', axisId, title: '濃度' },
      { type: 'set-axis-title-style', axisId, field: 'family', value: 'Georgia' },
      { type: 'set-axis-title-style', axisId, field: 'sizePx', value: 18 },
      { type: 'set-axis-title-style', axisId, field: 'color', value: '#334455' },
      { type: 'set-axis-title-style', axisId, field: 'bold', value: true },
    ])
    expect(toPlotlyFigure(changed).layout.xaxis?.title).toMatchObject({
      text: '濃度',
      font: { family: 'Georgia', size: 18, color: '#334455', weight: 'bold' },
    })

    const hidden = projectReducer(changed, { type: 'set-axis-title-visible', axisId, visible: false })
    expect(toPlotlyFigure(hidden).layout.xaxis?.title).toMatchObject({ text: '' })
  })

  it('maps plot background, border shape, and manual margins', () => {
    const project = reduce(sampleProject(), [
      { type: 'set-chart-background', field: 'plotBackgroundColor', value: '#fafafa' },
      { type: 'set-plot-area-border', field: 'visible', value: true },
      { type: 'set-plot-area-border', field: 'color', value: '#224466' },
      { type: 'set-plot-area-border', field: 'widthPx', value: 2 },
      { type: 'set-plot-margin-mode', value: 'manual' },
      { type: 'set-plot-margin', field: 'topPx', value: 50 },
      { type: 'set-plot-margin', field: 'rightPx', value: 40 },
      { type: 'set-plot-margin', field: 'bottomPx', value: 90 },
      { type: 'set-plot-margin', field: 'leftPx', value: 100 },
    ])
    const layout = toPlotlyFigure(project).layout
    expect(layout).toMatchObject({
      plot_bgcolor: '#fafafa',
      margin: { t: 50, r: 40, b: 90, l: 100 },
      xaxis: { automargin: false },
      yaxis: { automargin: false },
      shapes: [{
        type: 'rect',
        xref: 'paper',
        yref: 'paper',
        line: { color: '#224466', width: 2 },
      }],
    })
  })

  it('keeps numeric-only options off a category axis but applies meaningful label and grid styles', () => {
    const project = sampleBarProject()
    const categoryAxis = project.chart.axes.find((axis) => axis.dimension === 'x')!
    categoryAxis.scale.minimum = 1
    categoryAxis.scale.maximum = 5
    categoryAxis.scale.type = 'log'
    categoryAxis.ticks.majorInterval = { mode: 'fixed', step: 2 }
    categoryAxis.numberFormat = { kind: 'decimal', decimalPlaces: 2 }
    categoryAxis.labels.angleDeg = 45
    categoryAxis.gridLines.majorStyle = { color: '#123456', widthPx: 2, style: 'dot' }
    const axis = toPlotlyFigure(project).layout.xaxis
    expect(axis).toMatchObject({
      type: 'category',
      tickangle: 45,
      gridcolor: '#123456',
      gridwidth: 2,
      griddash: 'dot',
    })
    expect(axis).not.toHaveProperty('range')
    expect(axis).not.toHaveProperty('dtick')
    expect(axis).not.toHaveProperty('tickformat')
    expect(axis).not.toHaveProperty('minor')
  })

  it('round-trips the complete Phase 3C semantic style state', () => {
    const project = sampleProject()
    const axis = project.chart.axes[0]
    axis.ticks.majorLengthPx = 9
    axis.ticks.minorLengthPx = 4
    axis.ticks.lineWidthPx = 2
    axis.labels = { ...axis.labels, visible: false, bold: true, angleDeg: 90 }
    axis.numberFormat = { kind: 'scientific', decimalPlaces: 3 }
    axis.gridLines.majorStyle = { color: '#112233', widthPx: 2, style: 'dash' }
    axis.gridLines.minorStyle = { color: '#445566', widthPx: 1, style: 'dot' }
    axis.title = {
      visible: true,
      text: 'X title',
      style: { family: 'Georgia', sizePx: 18, color: '#334455', bold: true },
    }
    project.chart.plotArea = {
      border: { visible: true, color: '#556677', widthPx: 2 },
      margin: { mode: 'manual', topPx: 40, rightPx: 30, bottomPx: 80, leftPx: 90 },
    }
    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('hydrates a pre-Phase-3C schema 0.1 file with safe defaults', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    delete file.project.chart.plotArea
    for (const axis of file.project.chart.axes) {
      delete axis.title.style
      delete axis.ticks.majorLengthPx
      delete axis.ticks.minorLengthPx
      delete axis.ticks.lineWidthPx
      delete axis.labels.visible
      delete axis.labels.bold
      delete axis.labels.angleDeg
      delete axis.gridLines.majorStyle
      delete axis.gridLines.minorStyle
      delete axis.numberFormat
    }
    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.chart.axes[0]).toMatchObject({
      title: { style: { family: 'Arial', sizePx: 14, color: '#172033', bold: false } },
      ticks: { majorLengthPx: 6, minorLengthPx: 3, lineWidthPx: 1 },
      labels: { visible: true, bold: false, angleDeg: 0 },
      gridLines: {
        majorStyle: { color: '#d7dde7', widthPx: 1, style: 'solid' },
        minorStyle: { color: '#e8ecf2', widthPx: 0.5, style: 'dot' },
      },
      numberFormat: { kind: 'auto' },
    })
    expect(result.project.chart.plotArea).toMatchObject({
      border: { visible: false, color: '#4b5563', widthPx: 1 },
      margin: { mode: 'auto', topPx: 64, rightPx: 28, bottomPx: 70, leftPx: 78 },
    })
  })

  it('rejects invalid Phase 3C enum, number, and color values', () => {
    const invalidEnum = JSON.parse(serializeProjectFile(sampleProject()))
    invalidEnum.project.chart.axes[0].gridLines.majorStyle.style = 'longdash'
    expect(parseProjectFile(JSON.stringify(invalidEnum))).toMatchObject({
      ok: false,
      error: { code: 'schema.project' },
    })

    const invalidNumber = JSON.parse(serializeProjectFile(sampleProject()))
    invalidNumber.project.chart.axes[0].ticks.majorLengthPx = -1
    expect(parseProjectFile(JSON.stringify(invalidNumber))).toMatchObject({
      ok: false,
      error: { code: 'style.tickLength' },
    })

    const invalidColor = JSON.parse(serializeProjectFile(sampleProject()))
    invalidColor.project.chart.plotArea.border.color = 'navy'
    expect(parseProjectFile(JSON.stringify(invalidColor))).toMatchObject({
      ok: false,
      error: { code: 'plotArea.borderColor' },
    })
  })

  it('rejects an invalid decimal-place count at runtime', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.axes[0].numberFormat = { kind: 'decimal', decimalPlaces: 1.5 }
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      error: { code: 'style.decimalPlaces' },
    })
  })

  it('keeps the previous model when tick or manual-margin input is invalid', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const tick = prepareProjectAction(project, {
      type: 'set-axis-tick-style',
      axisId,
      field: 'majorLengthPx',
      value: 31,
    })
    expect(tick).toMatchObject({ ok: false, issue: { code: 'axis.tickLength' } })

    const manual = projectReducer(project, { type: 'set-plot-margin-mode', value: 'manual' })
    const margin = prepareProjectAction(manual, {
      type: 'set-plot-margin',
      field: 'leftPx',
      value: 700,
    })
    expect(margin).toMatchObject({ ok: false, issue: { code: 'plotArea.margin' } })
  })
})
