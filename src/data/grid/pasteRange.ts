import type { IdFactory } from '../../model/createProject'
import { randomId } from '../../model/createProject'
import { DATA_LIMITS } from '../../model/limits'
import type { CellValue, DatasetModel } from '../../model/types'

export interface ActiveCell {
  rowIndex: number
  columnIndex: number
}

export interface GridPaste {
  start: ActiveCell
  values: CellValue[][]
}

export type PasteRangeResult =
  | {
      ok: true
      dataset: DatasetModel
      pastedRows: number
      pastedColumns: number
    }
  | { ok: false; message: string }

function columnLabel(index: number): string {
  let value = index + 1
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

function defaultColumnName(index: number): string {
  return `Column ${columnLabel(index)}`
}

function headerText(value: CellValue): string {
  return value === null ? '' : String(value)
}

function validPasteShape(values: CellValue[][]): number | null {
  if (values.length === 0 || values[0]?.length === 0) return null
  const width = values[0].length
  return values.every((row) => row.length === width) ? width : null
}

export function applyRectangularPaste(
  current: DatasetModel | undefined,
  paste: GridPaste,
  idFactory: IdFactory = randomId,
): PasteRangeResult {
  const width = validPasteShape(paste.values)
  if (
    width === null ||
    !Number.isInteger(paste.start.rowIndex) ||
    !Number.isInteger(paste.start.columnIndex) ||
    paste.start.rowIndex < 0 ||
    paste.start.columnIndex < 0
  ) {
    return { ok: false, message: '貼り付け範囲が不正です。' }
  }

  const requiredColumns = paste.start.columnIndex + width
  const lastGridRow = paste.start.rowIndex + paste.values.length - 1
  const requiredDataRows = Math.max(0, lastGridRow)
  if (requiredColumns > DATA_LIMITS.maxColumns) {
    return {
      ok: false,
      message: `貼り付け後の列数は${DATA_LIMITS.maxColumns}列以下にしてください。`,
    }
  }
  if (requiredDataRows > DATA_LIMITS.maxRows) {
    return {
      ok: false,
      message: `貼り付け後のデータ行は${DATA_LIMITS.maxRows}行以下にしてください。`,
    }
  }

  const existingColumns = current?.columns ?? []
  const existingRows = current?.rows ?? []
  const columnCount = Math.max(existingColumns.length, requiredColumns)
  const rowCount = Math.max(existingRows.length, requiredDataRows)
  const columns = Array.from({ length: columnCount }, (_, index) =>
    existingColumns[index]
      ? { ...existingColumns[index] }
      : { id: idFactory(), name: defaultColumnName(index) },
  )
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const existingRow = existingRows[rowIndex]
    const cells: Record<string, CellValue> = {}
    for (const column of columns) {
      cells[column.id] = existingRow?.cells[column.id] ?? null
    }
    return {
      id: existingRow?.id ?? idFactory(),
      cells,
    }
  })

  for (let sourceRow = 0; sourceRow < paste.values.length; sourceRow += 1) {
    const gridRow = paste.start.rowIndex + sourceRow
    for (let sourceColumn = 0; sourceColumn < width; sourceColumn += 1) {
      const columnIndex = paste.start.columnIndex + sourceColumn
      const value = paste.values[sourceRow][sourceColumn]
      if (gridRow === 0) {
        columns[columnIndex] = {
          ...columns[columnIndex],
          name: headerText(value),
        }
      } else {
        rows[gridRow - 1].cells[columns[columnIndex].id] = value
      }
    }
  }

  return {
    ok: true,
    dataset: {
      id: current?.id ?? idFactory(),
      name: current?.name ?? 'Pasted table',
      columns,
      rows,
      extensions: current?.extensions ?? {},
    },
    pastedRows: paste.values.length,
    pastedColumns: width,
  }
}

export function cellAddress(cell: ActiveCell): string {
  return `${columnLabel(cell.columnIndex)}${cell.rowIndex + 1}`
}
