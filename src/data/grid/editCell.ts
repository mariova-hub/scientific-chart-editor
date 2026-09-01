import type { IdFactory } from '../../model/createProject'
import { randomId } from '../../model/createProject'
import type { CellValue, DatasetModel } from '../../model/types'
import { parseCell } from '../tsv/parseTsv'
import {
  applyRectangularPaste,
  type ActiveCell,
  type PasteRangeResult,
} from './pasteRange'

export type CellEditResult =
  | { ok: true; changed: false }
  | { ok: true; changed: true; dataset: DatasetModel }
  | { ok: false; message: string }

function headerText(value: CellValue): string {
  return value === null ? '' : String(value)
}

function existingValue(
  dataset: DatasetModel,
  cell: ActiveCell,
): CellValue | undefined {
  const column = dataset.columns[cell.columnIndex]
  if (!column) return undefined
  if (cell.rowIndex === 0) return column.name
  const row = dataset.rows[cell.rowIndex - 1]
  return row ? row.cells[column.id] ?? null : undefined
}

export function readGridCellText(
  dataset: DatasetModel | undefined,
  cell: ActiveCell,
): string {
  if (!dataset) return ''
  const value = existingValue(dataset, cell)
  return value === null || value === undefined ? '' : String(value)
}

export function applyCellValue(
  current: DatasetModel | undefined,
  cell: ActiveCell,
  value: CellValue,
  idFactory: IdFactory = randomId,
): CellEditResult {
  if (!current || existingValue(current, cell) === undefined) {
    const result: PasteRangeResult = applyRectangularPaste(
      current,
      { start: cell, values: [[value]] },
      idFactory,
    )
    return result.ok
      ? { ok: true, changed: true, dataset: result.dataset }
      : result
  }

  const previous = existingValue(current, cell)
  const nextValue = cell.rowIndex === 0 ? headerText(value) : value
  if (Object.is(previous, nextValue)) return { ok: true, changed: false }

  if (cell.rowIndex === 0) {
    const columns = [...current.columns]
    columns[cell.columnIndex] = {
      ...columns[cell.columnIndex],
      name: String(nextValue),
    }
    return {
      ok: true,
      changed: true,
      dataset: { ...current, columns },
    }
  }

  const column = current.columns[cell.columnIndex]
  const rows = [...current.rows]
  const rowIndex = cell.rowIndex - 1
  rows[rowIndex] = {
    ...rows[rowIndex],
    cells: { ...rows[rowIndex].cells, [column.id]: value },
  }
  return {
    ok: true,
    changed: true,
    dataset: { ...current, rows },
  }
}

export function applyCellEdit(
  current: DatasetModel | undefined,
  cell: ActiveCell,
  draft: string,
  idFactory: IdFactory = randomId,
): CellEditResult {
  return applyCellValue(current, cell, parseCell(draft), idFactory)
}

export function clearGridCell(
  current: DatasetModel | undefined,
  cell: ActiveCell,
): CellEditResult {
  if (!current || existingValue(current, cell) === undefined) {
    return { ok: true, changed: false }
  }
  return applyCellValue(current, cell, null)
}
