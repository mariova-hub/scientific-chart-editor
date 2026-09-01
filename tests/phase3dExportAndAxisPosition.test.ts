import { describe, expect, it } from 'vitest'
import { STYLE_LIMITS } from '../src/model/limits'
import { parseProjectFile, serializeProjectFile } from '../src/persistence/projectFile'
import {
  DEFAULT_CHART_EXPORT_OPTIONS,
  prepareImageExport,
  type ChartExportOptions,
} from '../src/renderer/exportOptions'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { prepareProjectAction } from '../src/state/projectActionGuard'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sampleProject } from './helpers'

type AxisWithLabelDistance = NonNullable<
  ReturnType<typeof toPlotlyFigure>['layout']['xaxis']
> & { ticklabelstandoff?: number }

function plotlyXAxis(project = sampleProject()): AxisWithLabelDistance {
  return toPlotlyFigure(project).layout.xaxis as AxisWithLabelDistance
}

describe('Phase 3D axis text position', () => {
  it('maps outside tick labels and their distance', () => {
    const project = sampleProject()
    const axisId = project.chart.axes[0].id
    const changed = projectReducer(
      projectReducer(project, {
        type: 'set-axis-label-style',
        axisId,
        field: 'position',
        value: 'outside',
      }),
      {
        type: 'set-axis-label-style',
        axisId,
        field: 'distancePx',
        value: 12,
      },
    )
    expect(plotlyXAxis(changed)).toMatchObject({
      ticklabelposition: 'outside',
      ticklabelstandoff: 12,
    })
  })

  it('maps inside labels independently for X and Y', () => {
    const project = sampleProject()
    project.chart.axes[0].labels = {
      ...project.chart.axes[0].labels,
      position: 'inside',
      distancePx: 7,
    }
    project.chart.axes[1].labels = {
      ...project.chart.axes[1].labels,
      position: 'outside',
      distancePx: 19,
    }
    const figure = toPlotlyFigure(project)
    expect(figure.layout.xaxis).toMatchObject({ ticklabelposition: 'inside' })
    expect(figure.layout.yaxis).toMatchObject({ ticklabelposition: 'outside' })
    expect((figure.layout.xaxis as AxisWithLabelDistance).ticklabelstandoff).toBe(7)
    expect((figure.layout.yaxis as AxisWithLabelDistance).ticklabelstandoff).toBe(19)
  })

  it('applies label position and distance to a category axis', () => {
    const project = sampleBarProject()
    project.chart.axes[0].labels.position = 'inside'
    project.chart.axes[0].labels.distancePx = 6
    expect(plotlyXAxis(project)).toMatchObject({
      type: 'category',
      ticklabelposition: 'inside',
      ticklabelstandoff: 6,
    })
  })

  it('maps independent axis-title distance', () => {
    const project = sampleProject()
    project.chart.axes[0].title.distancePx = 10
    project.chart.axes[1].title.distancePx = 40
    const figure = toPlotlyFigure(project)
    expect(figure.layout.xaxis?.title).toMatchObject({ standoff: 10 })
    expect(figure.layout.yaxis?.title).toMatchObject({ standoff: 40 })
  })

  it('round-trips all Phase 3D position settings', () => {
    const project = sampleProject()
    project.chart.axes[0].labels.position = 'inside'
    project.chart.axes[0].labels.distancePx = 14
    project.chart.axes[0].title.distancePx = 26
    project.chart.axes[1].labels.distancePx = 9
    project.chart.axes[1].title.distancePx = 31
    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('hydrates a pre-Phase-3D 0.1 file with safe defaults', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    for (const axis of file.project.chart.axes) {
      delete axis.labels.position
      delete axis.labels.distancePx
      delete axis.title.distancePx
    }
    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.chart.axes[0]).toMatchObject({
      labels: { position: 'outside', distancePx: 0 },
      title: { distancePx: 8 },
    })
  })

  it.each([
    ['invalid position', 'labels.position', 'high'],
    ['invalid label distance', 'labels.distancePx', -1],
    ['invalid title distance', 'title.distancePx', 101],
  ])('rejects %s from a saved file', (_name, path, value) => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    const [section, field] = path.split('.')
    file.project.chart.axes[0][section][field] = value
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({ ok: false })
  })

  it('keeps the previous model when a distance edit is invalid', () => {
    const project = sampleProject()
    const prepared = prepareProjectAction(project, {
      type: 'set-axis-title-distance',
      axisId: project.chart.axes[0].id,
      value: STYLE_LIMITS.maxAxisTextDistancePx + 1,
    })
    expect(prepared).toMatchObject({
      ok: false,
      issue: { code: 'axis.titleDistance' },
    })
    expect(project.chart.axes[0].title.distancePx).toBe(8)
  })
})

describe('Phase 3D export options', () => {
  it.each([1, 2, 3] as const)('prepares PNG %d× without changing logical size', (pngScale) => {
    const project = sampleProject()
    const originalSize = { ...project.chart.size }
    const options: ChartExportOptions = {
      ...DEFAULT_CHART_EXPORT_OPTIONS,
      pngScale,
    }
    expect(prepareImageExport(project, options)).toMatchObject({
      format: 'png',
      width: 760,
      height: 480,
      scale: pngScale,
    })
    expect(project.chart.size).toEqual(originalSize)
  })

  it('maps current and transparent PNG backgrounds without model mutation', () => {
    const project = sampleProject()
    const originalStyle = { ...project.chart.style }
    expect(prepareImageExport(project, DEFAULT_CHART_EXPORT_OPTIONS).transparentBackground).toBe(false)
    expect(prepareImageExport(project, {
      ...DEFAULT_CHART_EXPORT_OPTIONS,
      background: 'transparent',
    }).transparentBackground).toBe(true)
    expect(toPlotlyFigure(project, { transparentBackground: true }).layout).toMatchObject({
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    })
    expect(project.chart.style).toEqual(originalStyle)
  })

  it('uses logical size and scale 1 for SVG', () => {
    const project = sampleProject()
    expect(prepareImageExport(project, {
      ...DEFAULT_CHART_EXPORT_OPTIONS,
      format: 'svg',
      pngScale: 3,
      background: 'transparent',
    })).toEqual({
      format: 'svg',
      filename: 'scientific-chart',
      width: 760,
      height: 480,
      scale: 1,
      transparentBackground: false,
    })
  })
})
