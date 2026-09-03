import { describe, expect, it } from 'vitest'
import {
  applyCellEdit,
  clearGridCell,
  readGridCellText,
} from '../src/data/grid/editCell'
import type { ActiveCell } from '../src/data/grid/pasteRange'
import { resolveBarSeries } from '../src/model/dataBinding'
import type { DatasetModel } from '../src/model/types'
import {
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject, sequentialIds } from './helpers'

function commit(
  dataset: DatasetModel,
  cell: ActiveCell,
  draft: string,
): DatasetModel {
  const result = applyCellEdit(dataset, cell, draft, sequentialIds('edit'))
  if (!result.ok) throw new Error(result.message)
  if (!result.changed) return dataset
  return result.dataset
}

function clear(dataset: DatasetModel, cell: ActiveCell): DatasetModel {
  const result = clearGridCell(dataset, cell)
  if (!result.ok) throw new Error(result.message)
  if (!result.changed) return dataset
  return result.dataset
}

function valueAt(dataset: DatasetModel, rowIndex: number, columnIndex: number) {
  const column = dataset.columns[columnIndex]
  return rowIndex === 0
    ? column.name
    : dataset.rows[rowIndex - 1].cells[column.id]
}

describe('active cell copy text', () => {
  it('reads a header name', () => {
    const dataset = sampleBarProject().datasets[0]
    expect(readGridCellText(dataset, { rowIndex: 0, columnIndex: 1 })).toBe('平均')
  })

  it('converts number and string cells to text', () => {
    const dataset = sampleBarProject().datasets[0]
    expect(readGridCellText(dataset, { rowIndex: 1, columnIndex: 0 })).toBe('3')
    dataset.rows[0].cells[dataset.columns[0].id] = '試験管3'
    expect(readGridCellText(dataset, { rowIndex: 1, columnIndex: 0 })).toBe('試験管3')
  })

  it('converts a null cell to empty text', () => {
    const dataset = sampleBarProject().datasets[0]
    dataset.rows[0].cells[dataset.columns[0].id] = null
    expect(readGridCellText(dataset, { rowIndex: 1, columnIndex: 0 })).toBe('')
  })
})

describe('direct cell edit commit', () => {
  it.each([
    ['finite number', '1.60', 1.6],
    ['exponent', '1.2e3', 1200],
    ['string', 'average', 'average'],
    ['Japanese string', '平均吸光度', '平均吸光度'],
    ['empty text', '', null],
    ['whitespace', '   ', null],
    ['NaN text', 'NaN', 'NaN'],
    ['Infinity text', 'Infinity', 'Infinity'],
  ])('uses the shared cell parser for %s', (_label, draft, expected) => {
    const dataset = sampleBarProject().datasets[0]
    const next = commit(dataset, { rowIndex: 2, columnIndex: 1 }, draft)
    expect(valueAt(next, 2, 1)).toBe(expected)
  })

  it('preserves row and column IDs when a data cell is edited', () => {
    const dataset = sampleBarProject().datasets[0]
    const next = commit(dataset, { rowIndex: 2, columnIndex: 1 }, '1.60')
    expect(next.rows.map((row) => row.id)).toEqual(
      dataset.rows.map((row) => row.id),
    )
    expect(next.columns.map((column) => column.id)).toEqual(
      dataset.columns.map((column) => column.id),
    )
  })

  it('edits a header without changing its column ID', () => {
    const dataset = sampleBarProject().datasets[0]
    const columnId = dataset.columns[0].id
    const next = commit(dataset, { rowIndex: 0, columnIndex: 0 }, '試験管番号')
    expect(next.columns[0]).toEqual({ id: columnId, name: '試験管番号' })
  })

  it('keeps value and error bindings while values are edited', () => {
    let project = sampleBarProject()
    const bindings = structuredClone(project.chart.series[0].barBindings)
    const dataset = commit(project.datasets[0], { rowIndex: 2, columnIndex: 1 }, '1.60')
    project = projectReducer(project, { type: 'edit-cell', dataset })
    expect(project.chart.series[0].barBindings).toEqual(bindings)
    expect(resolveBarSeries(project, project.chart.series[0]).points[1].value).toBe(1.6)
  })

  it('keeps a header binding after the visible name changes', () => {
    let project = sampleBarProject()
    const categoryBinding = structuredClone(project.chart.series[0].barBindings.category)
    const dataset = commit(project.datasets[0], { rowIndex: 0, columnIndex: 0 }, '試験管番号')
    project = projectReducer(project, { type: 'edit-cell', dataset })
    expect(project.chart.series[0].barBindings.category).toEqual(categoryBinding)
  })
})

describe('single cell clear', () => {
  it('clears a data cell to null for Delete without removing IDs', () => {
    const dataset = sampleBarProject().datasets[0]
    const next = clear(dataset, { rowIndex: 2, columnIndex: 2 })
    expect(valueAt(next, 2, 2)).toBeNull()
    expect(next.rows.map((row) => row.id)).toEqual(dataset.rows.map((row) => row.id))
    expect(next.columns.map((column) => column.id)).toEqual(
      dataset.columns.map((column) => column.id),
    )
  })

  it('uses the same null clear semantics for Backspace', () => {
    const dataset = sampleBarProject().datasets[0]
    const next = clear(dataset, { rowIndex: 3, columnIndex: 1 })
    expect(valueAt(next, 3, 1)).toBeNull()
  })

  it('clears a header to an empty name while preserving the column', () => {
    const dataset = sampleBarProject().datasets[0]
    const columnId = dataset.columns[2].id
    const next = clear(dataset, { rowIndex: 0, columnIndex: 2 })
    expect(next.columns[2]).toEqual({ id: columnId, name: '' })
    expect(next.columns).toHaveLength(dataset.columns.length)
  })

  it('keeps the error binding and recalculates invalid-error state', () => {
    let project = sampleBarProject()
    const errorBinding = structuredClone(project.chart.series[0].barBindings.error)
    const dataset = clear(project.datasets[0], { rowIndex: 2, columnIndex: 2 })
    project = projectReducer(project, { type: 'clear-cell', dataset })
    const resolved = resolveBarSeries(project, project.chart.series[0])
    expect(project.chart.series[0].barBindings.error).toEqual(errorBinding)
    expect(resolved.invalidErrorRowIds).toHaveLength(1)
    expect(resolved.showErrorBars).toBe(false)
    expect(resolved.points).toHaveLength(5)
  })
})

describe('direct cell edit persistence', () => {
  it('round-trips a directly edited value', () => {
    let project = sampleBarProject()
    const dataset = commit(project.datasets[0], { rowIndex: 2, columnIndex: 1 }, '1.60')
    project = projectReducer(project, { type: 'edit-cell', dataset })
    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(project)
  })

  it('round-trips a cleared cell and its stable references', () => {
    let project = sampleBarProject()
    const dataset = clear(project.datasets[0], { rowIndex: 2, columnIndex: 2 })
    project = projectReducer(project, { type: 'clear-cell', dataset })
    const parsed = parseProjectFile(serializeProjectFile(project))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project).toEqual(project)
  })
})
