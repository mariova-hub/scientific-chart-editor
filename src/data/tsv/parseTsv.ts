import { DATA_LIMITS } from '../../model/limits'
import type { CellValue, DatasetModel } from '../../model/types'
import { randomId, type IdFactory } from '../../model/createProject'

export class TsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TsvParseError'
  }
}

const FINITE_NUMBER_PATTERN =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/

export function parseCell(rawCell: string): CellValue {
  const trimmed = rawCell.trim()
  if (trimmed === '') return null

  if (FINITE_NUMBER_PATTERN.test(trimmed)) {
    const numericValue = Number(trimmed)
    if (Number.isFinite(numericValue)) return numericValue
  }

  return rawCell
}

export function parseClipboardTsv(source: string): CellValue[][] {
  const normalized = source.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  while (lines.length > 1 && lines.at(-1) === '') lines.pop()

  const rawRows = lines.map((line) => line.split('\t'))
  const width = Math.max(...rawRows.map((row) => row.length))
  return rawRows.map((row) =>
    Array.from({ length: width }, (_, columnIndex) =>
      parseCell(row[columnIndex] ?? ''),
    ),
  )
}

export function parseTsv(
  source: string,
  idFactory: IdFactory = randomId,
): DatasetModel {
  const normalized = source.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')

  while (lines.length > 1 && lines.at(-1) === '') lines.pop()
  if (lines.length === 0 || lines[0].trim() === '') {
    throw new TsvParseError('1行目に列見出しが必要です。')
  }

  const headerCells = lines[0].split('\t')
  if (headerCells.length > DATA_LIMITS.maxColumns) {
    throw new TsvParseError(
      `列数は${DATA_LIMITS.maxColumns}列以下にしてください。`,
    )
  }

  const dataLines = lines.slice(1)
  if (dataLines.length > DATA_LIMITS.maxRows) {
    throw new TsvParseError(
      `データ行は${DATA_LIMITS.maxRows}行以下にしてください。`,
    )
  }

  const columns = headerCells.map((header, index) => ({
    id: idFactory(),
    name: header.trim() || `Column ${index + 1}`,
  }))

  const rows = dataLines.map((line, rowIndex) => {
    const rawCells = line.split('\t')
    if (rawCells.length > columns.length) {
      throw new TsvParseError(
        `${rowIndex + 2}行目の列数が見出し行を超えています。`,
      )
    }

    const cells: Record<string, CellValue> = {}
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      cells[columns[columnIndex].id] = parseCell(rawCells[columnIndex] ?? '')
    }

    return { id: idFactory(), cells }
  })

  return {
    id: idFactory(),
    name: 'Pasted table',
    columns,
    rows,
    extensions: {},
  }
}
