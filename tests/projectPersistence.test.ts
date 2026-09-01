import { describe, expect, it } from 'vitest'
import {
  loadProjectAtomically,
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { projectReducer } from '../src/state/projectReducer'
import { sampleProject } from './helpers'

describe('project persistence', () => {
  it('round-trips the complete Phase 1 editing state', () => {
    let project = sampleProject()
    project = projectReducer(project, {
      type: 'set-axis-bound',
      dimension: 'x',
      bound: 'minimum',
      value: 2,
    })
    project = projectReducer(project, {
      type: 'set-axis-major-unit',
      dimension: 'y',
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
})
