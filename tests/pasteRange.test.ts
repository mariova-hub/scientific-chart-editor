import { describe, expect, it } from 'vitest'
import {
  applyRectangularPaste,
  type ActiveCell,
} from '../src/data/grid/pasteRange'
import { parseClipboardTsv } from '../src/data/tsv/parseTsv'
import { createEmptyProject } from '../src/model/createProject'
import { resolveBarSeries } from '../src/model/dataBinding'
import { DATA_LIMITS } from '../src/model/limits'
import {
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sequentialIds } from './helpers'

let pasteSequence = 0

function paste(
  source: string,
  start: ActiveCell,
  current?: ReturnType<typeof sampleBarProject>['datasets'][number],
) {
  return applyRectangularPaste(
    current,
    { start, values: parseClipboardTsv(source) },
    sequentialIds(`new${++pasteSequence}`),
  )
}

describe('rectangular grid paste', () => {
  it('creates the initial table through the same A1 paste contract', () => {
    const result = paste('試験管\t平均\n3\t1.24\n4\t1.51', {
      rowIndex: 0,
      columnIndex: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.dataset.columns.map((column) => column.name)).toEqual([
      '試験管',
      '平均',
    ])
    expect(result.dataset.rows.map((row) => Object.values(row.cells))).toEqual([
      [3, 1.24],
      [4, 1.51],
    ])
  })

  it('adds an SD column by pasting at C1 without changing A or B', () => {
    const first = paste('試験管\t平均\n3\t1.24\n4\t1.51', {
      rowIndex: 0,
      columnIndex: 0,
    })
    if (!first.ok) throw new Error(first.message)
    const before = structuredClone(first.dataset)
    const second = paste('SD\n0.08\n0.12', {
      rowIndex: 0,
      columnIndex: 2,
    }, first.dataset)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.dataset.columns.map((column) => column.name)).toEqual([
      '試験管',
      '平均',
      'SD',
    ])
    expect(second.dataset.rows.map((row) => Object.values(row.cells))).toEqual([
      [3, 1.24, 0.08],
      [4, 1.51, 0.12],
    ])
    expect(second.dataset.columns.slice(0, 2)).toEqual(before.columns)
  })

  it('overwrites only B3 for a one-cell paste', () => {
    const project = sampleBarProject()
    const before = structuredClone(project.datasets[0])
    const result = paste('1.60', { rowIndex: 2, columnIndex: 1 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    const valueColumn = result.dataset.columns[1]
    expect(result.dataset.rows[1].cells[valueColumn.id]).toBe(1.6)
    expect(result.dataset.rows[0]).toEqual(before.rows[0])
    expect(result.dataset.rows.slice(2)).toEqual(before.rows.slice(2))
  })

  it('extends rows when pasting at A8 and preserves the gap row', () => {
    const project = sampleBarProject()
    const result = paste('8\t2.5\t0.11', { rowIndex: 7, columnIndex: 0 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    expect(result.dataset.rows).toHaveLength(7)
    expect(Object.values(result.dataset.rows[5].cells)).toEqual([null, null, null])
    expect(Object.values(result.dataset.rows[6].cells)).toEqual([8, 2.5, 0.11])
  })

  it('adds only the required new columns for a D1 paste', () => {
    const project = sampleBarProject()
    const result = paste('備考\nA\nB\nC\nD\nE', { rowIndex: 0, columnIndex: 3 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    expect(result.dataset.columns).toHaveLength(4)
    expect(result.dataset.columns[3].name).toBe('備考')
    expect(result.dataset.rows.map((row) => row.cells[result.dataset.columns[3].id])).toEqual([
      'A', 'B', 'C', 'D', 'E',
    ])
  })

  it('pastes a multi-row, multi-column block into only its rectangle', () => {
    const project = sampleBarProject()
    const result = paste('10\t20\n30\t40', { rowIndex: 2, columnIndex: 0 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    expect(Object.values(result.dataset.rows[1].cells)).toEqual([10, 20, 0.12])
    expect(Object.values(result.dataset.rows[2].cells)).toEqual([30, 40, 0.05])
    expect(result.dataset.rows[0]).toEqual(project.datasets[0].rows[0])
    expect(result.dataset.rows[3]).toEqual(project.datasets[0].rows[3])
  })
})

describe('stable IDs and bindings during paste', () => {
  it('keeps every existing column and row ID on value overwrite', () => {
    const project = sampleBarProject()
    const beforeColumnIds = project.datasets[0].columns.map((column) => column.id)
    const beforeRowIds = project.datasets[0].rows.map((row) => row.id)
    const result = paste('9.9', { rowIndex: 2, columnIndex: 1 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    expect(result.dataset.columns.map((column) => column.id)).toEqual(beforeColumnIds)
    expect(result.dataset.rows.map((row) => row.id)).toEqual(beforeRowIds)
  })

  it('creates IDs only for newly added rows and columns', () => {
    const project = sampleBarProject()
    const result = paste('追加\nX\nY\nZ\nU\nV\nW', { rowIndex: 0, columnIndex: 3 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    expect(result.dataset.columns.slice(0, 3).map((column) => column.id)).toEqual(
      project.datasets[0].columns.map((column) => column.id),
    )
    expect(result.dataset.columns[3].id).toMatch(/^new/)
    expect(result.dataset.rows.slice(0, 5).map((row) => row.id)).toEqual(
      project.datasets[0].rows.map((row) => row.id),
    )
    expect(result.dataset.rows[5].id).toMatch(/^new/)
  })

  it('keeps semantic bindings while values change and revalidates errors', () => {
    let project = sampleBarProject()
    const bindings = structuredClone(project.chart.series[0].barBindings)
    const result = paste('bad', { rowIndex: 2, columnIndex: 2 }, project.datasets[0])
    if (!result.ok) throw new Error(result.message)
    project = projectReducer(project, { type: 'paste-range', dataset: result.dataset })
    expect(project.chart.series[0].barBindings).toEqual(bindings)
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(resolved.points).toHaveLength(5)
    expect(resolved.invalidErrorRowIds).toHaveLength(1)
    expect(resolved.showErrorBars).toBe(false)
  })

  it('keeps A/B bindings when a new Error column is pasted later', () => {
    let project = createEmptyProject(sequentialIds('project'), '2026-09-01T00:00:00.000Z')
    const first = paste('カテゴリ\t値\nA\t1\nB\t2', { rowIndex: 0, columnIndex: 0 })
    if (!first.ok) throw new Error(first.message)
    project = projectReducer(project, { type: 'paste-range', dataset: first.dataset })
    const bindings = structuredClone(project.chart.series[0].bindings)
    const second = paste('誤差\n0.1\n0.2', { rowIndex: 0, columnIndex: 2 }, project.datasets[0])
    if (!second.ok) throw new Error(second.message)
    project = projectReducer(project, { type: 'paste-range', dataset: second.dataset })
    expect(project.chart.series[0].bindings).toEqual(bindings)
  })
})

describe('atomic paste bounds and persistence', () => {
  it('rejects a paste beyond the column limit without changing the dataset', () => {
    const project = sampleBarProject()
    const before = structuredClone(project.datasets[0])
    const result = paste('x', { rowIndex: 0, columnIndex: DATA_LIMITS.maxColumns }, project.datasets[0])
    expect(result).toMatchObject({ ok: false })
    expect(project.datasets[0]).toEqual(before)
  })

  it('rejects a paste beyond the row limit without changing the dataset', () => {
    const project = sampleBarProject()
    const before = structuredClone(project.datasets[0])
    const result = paste('x', { rowIndex: DATA_LIMITS.maxRows + 1, columnIndex: 0 }, project.datasets[0])
    expect(result).toMatchObject({ ok: false })
    expect(project.datasets[0]).toEqual(before)
  })

  it('round-trips the result of multiple paste actions with stable references', () => {
    let project = createEmptyProject(sequentialIds('project'), '2026-09-01T00:00:00.000Z')
    const first = paste('試験管\t平均\n3\t1.24\n4\t1.51', { rowIndex: 0, columnIndex: 0 })
    if (!first.ok) throw new Error(first.message)
    project = projectReducer(project, { type: 'paste-range', dataset: first.dataset })
    const second = paste('SD\n0.08\n0.12', { rowIndex: 0, columnIndex: 2 }, project.datasets[0])
    if (!second.ok) throw new Error(second.message)
    project = projectReducer(project, { type: 'paste-range', dataset: second.dataset })
    project = projectReducer(project, {
      type: 'set-binding',
      role: 'yError',
      columnId: project.datasets[0].columns[2].id,
    })

    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(project)
  })
})
