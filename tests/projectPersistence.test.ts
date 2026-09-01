import { describe, expect, it } from 'vitest'
import {
  loadProjectAtomically,
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sampleProject } from './helpers'

describe('project persistence', () => {
  it('round-trips the complete Phase 1 editing state', () => {
    let project = sampleProject()
    const xAxisId = project.chart.axes.find((axis) => axis.dimension === 'x')!.id
    const yAxisId = project.chart.axes.find((axis) => axis.dimension === 'y')!.id
    project = projectReducer(project, {
      type: 'set-axis-bound',
      axisId: xAxisId,
      bound: 'minimum',
      value: 2,
    })
    project = projectReducer(project, {
      type: 'set-axis-major-unit',
      axisId: yAxisId,
      value: 0.25,
    })
    project = projectReducer(project, {
      type: 'set-chart-size',
      dimension: 'widthPx',
      value: 900,
    })

    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('rejects an unsupported schemaVersion', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.schemaVersion = '9.9'
    const result = parseProjectFile(JSON.stringify(file))
    expect(result).toMatchObject({ ok: false, error: { code: 'schema.version' } })
  })

  it('rejects a different app identifier', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.app = 'other-app'
    const result = parseProjectFile(JSON.stringify(file))
    expect(result).toMatchObject({ ok: false, error: { code: 'schema.app' } })
  })

  it('rejects a broken dataset reference', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.series[0].bindings.x.datasetId = 'missing'
    const result = parseProjectFile(JSON.stringify(file))
    expect(result).toMatchObject({ ok: false, error: { code: 'reference.dataset' } })
  })

  it('rejects a broken axis reference', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.series[0].axisIds.x = 'missing'
    const result = parseProjectFile(JSON.stringify(file))
    expect(result).toMatchObject({ ok: false, error: { code: 'reference.axis' } })
  })

  it('rejects invalid JSON syntax', () => {
    expect(parseProjectFile('{broken')).toMatchObject({
      ok: false,
      error: { code: 'json.syntax' },
    })
  })

  it('keeps the current project reference when atomic load validation fails', () => {
    const current = sampleProject()
    const loaded = loadProjectAtomically(current, '{broken')
    expect(loaded.project).toBe(current)
    expect(loaded.error?.code).toBe('json.syntax')
  })

  it('rejects semantically invalid axis settings', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.axes[0].scale.minimum = 10
    file.project.chart.axes[0].scale.maximum = 1
    const result = parseProjectFile(JSON.stringify(file))
    expect(result).toMatchObject({ ok: false, error: { code: 'axis.range' } })
  })

  it('preserves unknown fields when a validated file is saved again', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.futureRendererNeutralOption = { enabled: true }
    const parsed = parseProjectFile(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const savedAgain = JSON.parse(serializeProjectFile(parsed.project))
    expect(savedAgain.project.chart.futureRendererNeutralOption).toEqual({
      enabled: true,
    })
  })

  it('round-trips every Phase 2 semantic style group', () => {
    let project = sampleProject()
    const axisId = project.chart.axes[0].id
    const seriesId = project.chart.series[0].id
    const actions = [
      { type: 'set-axis-minor-unit', axisId, value: 0.2 },
      { type: 'set-axis-tick-visible', axisId, kind: 'minor', visible: true },
      { type: 'set-axis-line', axisId, field: 'color', value: '#123456' },
      { type: 'set-axis-label-style', axisId, field: 'family', value: 'Georgia' },
      { type: 'set-series-marker', seriesId, field: 'shape', value: 'square' },
      { type: 'set-series-marker', seriesId, field: 'fillColor', value: '#334455' },
      { type: 'set-series-line', seriesId, field: 'dash', value: 'dot' },
      { type: 'set-error-bar-style', seriesId, field: 'capSizePx', value: 10 },
      { type: 'set-chart-background', field: 'plotBackgroundColor', value: '#eeeeee' },
      { type: 'set-chart-title-style', field: 'bold', value: true },
      { type: 'set-legend-visible', value: true },
      { type: 'set-legend-position', value: 'bottom' },
    ] as const
    for (const action of actions) project = projectReducer(project, action)

    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('hydrates a Phase 1 0.1 file that is missing all Phase 2 fields', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    delete file.project.chart.style
    delete file.project.chart.title.style
    for (const axis of file.project.chart.axes) {
      delete axis.line
      delete axis.labels
      delete axis.ticks.majorVisible
      delete axis.ticks.minorVisible
    }
    const series = file.project.chart.series[0]
    delete file.project.chart.bar
    delete series.barBindings
    delete series.style.line.color
    delete series.style.marker.fillColor
    delete series.style.marker.borderColor
    delete series.style.marker.borderWidthPx
    delete series.style.bar.opacity
    delete series.style.bar.widthRatio
    delete series.errorBars.x.style
    delete series.errorBars.y.style

    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.chart.style).toEqual({
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
    })
    expect(result.project.chart.axes[0]).toMatchObject({
      scale: { minimum: null, maximum: null },
      ticks: { majorVisible: true, minorVisible: false },
      line: { visible: true, color: '#4b5563', widthPx: 1 },
      labels: { family: 'Arial', sizePx: 12, color: '#374151' },
    })
    expect(result.project.chart.axes[0].ticks.majorInterval).toEqual({ mode: 'auto' })
    expect(result.project.chart.axes[0].ticks.minorInterval).toEqual({ mode: 'none' })
    expect(result.project.chart.series[0].style.marker).toMatchObject({
      fillColor: '#2563eb',
      borderColor: '#2563eb',
      borderWidthPx: 1,
    })
    expect(result.project.chart.series[0].errorBars.y.style.visible).toBe(true)
  })

  it('rejects an explicit invalid Phase 2 enum instead of defaulting it', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.series[0].style.marker.shape = 'star'
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      error: { code: 'schema.project' },
    })
  })

  it('rejects an explicit invalid color instead of silently correcting it', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    file.project.chart.style.backgroundColor = 'red'
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      error: { code: 'style.color' },
    })
  })

  it('round-trips horizontal bars, semantic bindings, and bar style', () => {
    let project = sampleBarProject()
    const seriesId = project.chart.series[0].id
    project = projectReducer(project, {
      type: 'set-bar-orientation',
      value: 'horizontal',
    })
    project = projectReducer(project, {
      type: 'set-bar-gap',
      value: 0.3,
    })
    project = projectReducer(project, {
      type: 'set-series-bar',
      seriesId,
      field: 'opacity',
      value: 0.75,
    })
    const result = parseProjectFile(serializeProjectFile(project))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.project).toEqual(project)
  })

  it('hydrates a Phase 2 scatter file with Phase 3A defaults', () => {
    const file = JSON.parse(serializeProjectFile(sampleProject()))
    delete file.project.chart.bar
    const series = file.project.chart.series[0]
    delete series.barBindings
    delete series.style.bar.opacity
    delete series.style.bar.widthRatio
    const result = parseProjectFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.chart.type).toBe('scatter')
    expect(result.project.chart.bar).toEqual({
      orientation: 'vertical',
      gapRatio: 0.2,
    })
    expect(result.project.chart.series[0].barBindings).toEqual({
      category: result.project.chart.series[0].bindings.x,
      value: result.project.chart.series[0].bindings.y,
      error: result.project.chart.series[0].errorBars.y.value?.source,
    })
  })

  it('rejects invalid bar orientation and explicit invalid bar style', () => {
    const file = JSON.parse(serializeProjectFile(sampleBarProject()))
    file.project.chart.bar.orientation = 'diagonal'
    expect(parseProjectFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      error: { code: 'schema.project' },
    })

    const styleFile = JSON.parse(serializeProjectFile(sampleBarProject()))
    styleFile.project.chart.series[0].style.bar.opacity = 2
    expect(parseProjectFile(JSON.stringify(styleFile))).toMatchObject({
      ok: false,
      error: { code: 'style.range' },
    })
  })
})
