import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProjectFile } from '../src/persistence/projectFile'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { prepareProjectAction } from '../src/state/projectActionGuard'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject } from './helpers'

const gapCases = [
  [0, 0],
  [50, 1 / 3],
  [100, 1 / 2],
  [200, 2 / 3],
  [500, 5 / 6],
] as const

function withGapPercent(gapPercent: number) {
  return projectReducer(sampleBarProject('試験管\t平均\tSD\n3\t128\t17\n4\t345\t76\n5\t159\t18\n6\t112\t12\n7\t104\t10'), {
    type: 'set-bar-gap-percent',
    value: gapPercent,
  })
}

describe('Phase 3D-1 Excel-like bar gap width', () => {
  it.each(gapCases)('maps %d%% to a monotonic Plotly gap of %f', (percent, expected) => {
    const figure = toPlotlyFigure(withGapPercent(percent))
    expect(figure.layout.bargap).toBeCloseTo(expected)
    expect(figure.data[0]).not.toHaveProperty('width')
  })

  it('makes the inferred automatic bar width decrease monotonically', () => {
    const widths = gapCases.map(([percent]) => {
      const gap = toPlotlyFigure(withGapPercent(percent)).layout.bargap as number
      return 1 - gap
    })
    expect(widths).toEqual([...widths].sort((left, right) => right - left))
    expect(widths[0]).toBeCloseTo(1)
    expect(widths.at(-1)).toBeCloseTo(1 / 6)
  })

  it.each(['vertical', 'horizontal'] as const)('uses the same contract for %s bars', (orientation) => {
    let project = withGapPercent(200)
    project = projectReducer(project, { type: 'set-bar-orientation', value: orientation })
    const figure = toPlotlyFigure(project)
    expect(figure.layout.bargap).toBeCloseTo(2 / 3)
    expect(figure.data[0]).not.toHaveProperty('width')
  })

  it.each(['vertical', 'horizontal'] as const)('keeps category and error alignment for %s bars', (orientation) => {
    let project = withGapPercent(500)
    project = projectReducer(project, { type: 'set-bar-orientation', value: orientation })
    const trace = toPlotlyFigure(project).data[0]
    if (orientation === 'vertical') {
      expect(trace).toMatchObject({
        x: [3, 4, 5, 6, 7],
        y: [128, 345, 159, 112, 104],
        error_y: { array: [17, 76, 18, 12, 10] },
      })
    } else {
      expect(trace).toMatchObject({
        x: [128, 345, 159, 112, 104],
        y: [3, 4, 5, 6, 7],
        error_x: { array: [17, 76, 18, 12, 10] },
      })
    }
  })

  it('keeps the gap meaning when chart size changes', () => {
    const project = withGapPercent(150)
    const firstGap = toPlotlyFigure(project).layout.bargap
    project.chart.size.widthPx = 1200
    expect(toPlotlyFigure(project).layout.bargap).toBe(firstGap)
  })

  it('uses the same mapping for screen, transparent PNG, and SVG figures', () => {
    const project = withGapPercent(100)
    const screen = toPlotlyFigure(project)
    const transparentExport = toPlotlyFigure(project, { transparentBackground: true })
    expect(transparentExport.layout.bargap).toBe(screen.layout.bargap)
    expect(transparentExport.data[0]).toEqual(screen.data[0])
  })

  it('round-trips the semantic percentage', () => {
    const project = withGapPercent(200)
    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('migrates an old fixed bar width while preserving its effective appearance', () => {
    const file = JSON.parse(serializeProjectFile(withGapPercent(150)))
    delete file.project.chart.bar.gapPercent
    file.project.chart.bar.gapRatio = 0.2
    file.project.chart.series[0].style.bar.widthRatio = 0.8
    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.chart.bar.gapPercent).toBe(25)
    expect(result.project.chart.series[0].style.bar).not.toHaveProperty('widthRatio')
    expect(toPlotlyFigure(result.project).layout.bargap).toBeCloseTo(0.2)
  })

  it('migrates an old layout gap when no fixed width exists', () => {
    const file = JSON.parse(serializeProjectFile(withGapPercent(150)))
    delete file.project.chart.bar.gapPercent
    file.project.chart.bar.gapRatio = 0.5
    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project.chart.bar.gapPercent).toBe(100)
  })

  it.each([-1, 501, Number.POSITIVE_INFINITY])('rejects invalid edit value %s atomically', (value) => {
    const project = withGapPercent(150)
    const result = prepareProjectAction(project, {
      type: 'set-bar-gap-percent',
      value,
    })
    expect(result).toMatchObject({
      ok: false,
      issue: { code: 'bar.gapPercent' },
    })
    expect(project.chart.bar.gapPercent).toBe(150)
  })

  it.each([-1, 501])('rejects saved gap percent %s', (value) => {
    const file = JSON.parse(serializeProjectFile(withGapPercent(150)))
    file.project.chart.bar.gapPercent = value
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      error: { code: 'style.range' },
    })
  })

  it('rejects a non-finite saved gap percent', () => {
    const json = serializeProjectFile(withGapPercent(150)).replace(
      '"gapPercent": 150',
      '"gapPercent": 1e999',
    )
    expect(parseProjectFile(json)).toMatchObject({
      ok: false,
      error: { code: 'schema.project' },
    })
  })
})
