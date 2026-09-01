import { describe, expect, it } from 'vitest'
import { applyCellEdit, clearGridCell } from '../src/data/grid/editCell'
import {
  formatDataRowLabel,
  resolveBarSeries,
} from '../src/model/dataBinding'
import type { ProjectFileV01 } from '../src/model/types'
import {
  loadProjectAtomically,
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { toPlotlyFigure } from '../src/renderer/plotly/plotlyAdapter'
import { projectReducer } from '../src/state/projectReducer'
import {
  sampleBarProject,
  sampleRowBarProject,
  sequentialIds,
} from './helpers'

describe('row-oriented bar binding', () => {
  it('reads category headers, value row, and error row without transposing data', () => {
    const project = sampleRowBarProject()
    const before = structuredClone(project.datasets[0])
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(resolved.points.map(({ category, value, error }) => [category, value, error])).toEqual([
      ['試験管3', 1.24, 0.08],
      ['試験管4', 1.51, 0.12],
      ['試験管5', 1.83, 0.05],
      ['試験管6', 2.1, 0.14],
      ['試験管7', 2.31, 0.09],
    ])
    expect(project.datasets[0]).toEqual(before)
  })

  it('uses the stable label column to display row names', () => {
    const project = sampleRowBarProject()
    const dataset = project.datasets[0]
    const labelColumnId = project.chart.series[0].barRowBindings.labelColumnId
    expect(formatDataRowLabel(dataset, dataset.rows[0], 0, labelColumnId)).toBe('2行目（平均）')
    expect(formatDataRowLabel(dataset, dataset.rows[1], 1, labelColumnId)).toBe('3行目（SD）')
  })

  it('uses only the explicit continuous category range', () => {
    const project = sampleRowBarProject(
      '項目\t試験管3\t試験管4\t試験管5\t試験管6\t試験管7\t備考\n平均\t1.24\t1.51\t1.83\t2.10\t2.31\t対象外\nSD\t0.08\t0.12\t0.05\t0.14\t0.09\t対象外',
    )
    expect(resolveBarSeries(project, project.chart.series[0]).points).toHaveLength(5)
  })

  it('excludes an invalid value without shifting the following error', () => {
    const project = sampleRowBarProject(
      '項目\tA\tB\tC\n平均\t1\tbad\t3\nSD\t0.1\t0.2\t0.3',
    )
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(resolved.points.map(({ category, error }) => [category, error])).toEqual([
      ['A', 0.1],
      ['C', 0.3],
    ])
    expect(resolved.skippedSourceIds).toHaveLength(1)
  })

  it.each([
    ['null', ''],
    ['negative', '-0.1'],
    ['string', 'bad'],
  ])('keeps bars but disables all errors for a %s row value', (_label, invalid) => {
    const project = sampleRowBarProject(
      `項目\tA\tB\tC\n平均\t1\t2\t3\nSD\t0.1\t${invalid}\t0.3`,
    )
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(resolved.points).toHaveLength(3)
    expect(resolved.invalidErrorSourceIds).toHaveLength(1)
    expect(resolved.showErrorBars).toBe(false)
  })

  it('accepts zero as a scientific error value', () => {
    const project = sampleRowBarProject(
      '項目\tA\tB\n平均\t1\t2\nSD\t0\t0.2',
    )
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(resolved.points.map((point) => point.error)).toEqual([0, 0.2])
    expect(resolved.showErrorBars).toBe(true)
  })
})

describe('row orientation mapping and stable edits', () => {
  it('maps rows to a vertical bar trace with Y errors', () => {
    const figure = toPlotlyFigure(sampleRowBarProject())
    expect(figure.data[0]).toMatchObject({
      type: 'bar',
      orientation: 'v',
      x: ['試験管3', '試験管4', '試験管5', '試験管6', '試験管7'],
      y: [1.24, 1.51, 1.83, 2.1, 2.31],
      error_y: { array: [0.08, 0.12, 0.05, 0.14, 0.09] },
    })
  })

  it('changes only renderer mapping for a horizontal bar', () => {
    let project = sampleRowBarProject()
    const rowBindings = structuredClone(project.chart.series[0].barRowBindings)
    project = projectReducer(project, { type: 'set-bar-orientation', value: 'horizontal' })
    expect(toPlotlyFigure(project).data[0]).toMatchObject({
      orientation: 'h',
      x: [1.24, 1.51, 1.83, 2.1, 2.31],
      y: ['試験管3', '試験管4', '試験管5', '試験管6', '試験管7'],
      error_x: { array: [0.08, 0.12, 0.05, 0.14, 0.09] },
    })
    expect(project.chart.series[0].barRowBindings).toEqual(rowBindings)
  })

  it('keeps the value row binding after a value cell edit', () => {
    let project = sampleRowBarProject()
    const bindings = structuredClone(project.chart.series[0].barRowBindings)
    const result = applyCellEdit(
      project.datasets[0],
      { rowIndex: 1, columnIndex: 2 },
      '1.60',
      sequentialIds('edit'),
    )
    if (!result.ok || !result.changed) throw new Error('edit failed')
    project = projectReducer(project, { type: 'edit-cell', dataset: result.dataset })
    expect(project.chart.series[0].barRowBindings).toEqual(bindings)
    expect(resolveBarSeries(project, project.chart.series[0]).points[1].value).toBe(1.6)
  })

  it('keeps the error row binding and recalculates validation after clear', () => {
    let project = sampleRowBarProject()
    const bindings = structuredClone(project.chart.series[0].barRowBindings)
    const result = clearGridCell(project.datasets[0], { rowIndex: 2, columnIndex: 2 })
    if (!result.ok || !result.changed) throw new Error('clear failed')
    project = projectReducer(project, { type: 'clear-cell', dataset: result.dataset })
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(project.chart.series[0].barRowBindings).toEqual(bindings)
    expect(resolved.invalidErrorSourceIds).toHaveLength(1)
    expect(resolved.showErrorBars).toBe(false)
  })

  it('keeps category references after a header edit', () => {
    let project = sampleRowBarProject()
    const bindings = structuredClone(project.chart.series[0].barRowBindings)
    const result = applyCellEdit(
      project.datasets[0],
      { rowIndex: 0, columnIndex: 1 },
      '試験管03',
      sequentialIds('edit'),
    )
    if (!result.ok || !result.changed) throw new Error('edit failed')
    project = projectReducer(project, { type: 'edit-cell', dataset: result.dataset })
    expect(project.chart.series[0].barRowBindings).toEqual(bindings)
    expect(resolveBarSeries(project, project.chart.series[0]).points[0].category).toBe('試験管03')
  })
})

describe('safe row and column switching', () => {
  it('does not invent row bindings when switching from columns to rows', () => {
    let project = sampleBarProject()
    project = projectReducer(project, { type: 'set-data-orientation', value: 'rows' })
    expect(project.chart.dataOrientation).toBe('rows')
    expect(project.chart.series[0].barRowBindings).toMatchObject({
      categoryStartColumnId: null,
      categoryEndColumnId: null,
      valueRowId: null,
      errorRowId: null,
    })
  })

  it('preserves both explicit binding sets while switching back and forth', () => {
    let project = sampleRowBarProject()
    const rowBindings = structuredClone(project.chart.series[0].barRowBindings)
    const columnBindings = structuredClone(project.chart.series[0].barBindings)
    project = projectReducer(project, { type: 'set-data-orientation', value: 'columns' })
    project = projectReducer(project, { type: 'set-data-orientation', value: 'rows' })
    expect(project.chart.series[0].barRowBindings).toEqual(rowBindings)
    expect(project.chart.series[0].barBindings).toEqual(columnBindings)
  })

  it('returns to columns mode when switching to unsupported scatter', () => {
    let project = sampleRowBarProject()
    project = projectReducer(project, { type: 'set-chart-type', value: 'scatter' })
    expect(project.chart.dataOrientation).toBe('columns')
  })
})

describe('row-oriented persistence and runtime validation', () => {
  it('round-trips row mode and horizontal bar orientation', () => {
    let project = sampleRowBarProject()
    project = projectReducer(project, { type: 'set-bar-orientation', value: 'horizontal' })
    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(project)
  })

  it('hydrates a Phase 3B-3 file as columns mode', () => {
    const file = JSON.parse(serializeProjectFile(sampleBarProject()))
    delete file.project.chart.dataOrientation
    delete file.project.chart.series[0].barRowBindings
    const parsed = parseProjectFile(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.project.chart.dataOrientation).toBe('columns')
    expect(parsed.project.chart.series[0].barRowBindings).toEqual({
      datasetId: null,
      categoryStartColumnId: null,
      categoryEndColumnId: null,
      valueRowId: null,
      errorRowId: null,
      labelColumnId: null,
    })
  })

  it.each([
    ['missing value row', (file: ProjectFileV01) => { file.project.chart.series[0].barRowBindings.valueRowId = 'missing' }, 'reference.row'],
    ['missing category column', (file: ProjectFileV01) => { file.project.chart.series[0].barRowBindings.categoryStartColumnId = 'missing' }, 'reference.column'],
    ['invalid category order', (file: ProjectFileV01) => {
      const binding = file.project.chart.series[0].barRowBindings
      const start = binding.categoryStartColumnId
      binding.categoryStartColumnId = binding.categoryEndColumnId
      binding.categoryEndColumnId = start
    }, 'binding.categoryRange'],
  ])('atomically rejects %s', (_label, mutate, code) => {
    const current = sampleBarProject()
    const file = JSON.parse(serializeProjectFile(sampleRowBarProject()))
    mutate(file)
    const loaded = loadProjectAtomically(current, JSON.stringify(file))
    expect(loaded.project).toBe(current)
    expect(loaded.error?.code).toBe(code)
  })

  it('atomically rejects an invalid data orientation enum', () => {
    const current = sampleBarProject()
    const file = JSON.parse(serializeProjectFile(sampleRowBarProject()))
    file.project.chart.dataOrientation = 'diagonal'
    const loaded = loadProjectAtomically(current, JSON.stringify(file))
    expect(loaded.project).toBe(current)
    expect(loaded.error?.code).toBe('schema.project')
  })

  it('rejects a broken stored row reference even while columns mode is active', () => {
    const current = sampleBarProject()
    const file = JSON.parse(serializeProjectFile(sampleRowBarProject()))
    file.project.chart.dataOrientation = 'columns'
    file.project.chart.series[0].barRowBindings.errorRowId = 'missing'
    const loaded = loadProjectAtomically(current, JSON.stringify(file))
    expect(loaded.project).toBe(current)
    expect(loaded.error?.code).toBe('reference.row')
  })
})
