import type {
  CellValue,
  DataRangeRef,
  DatasetModel,
  ProjectState,
  RowModel,
  SeriesModel,
} from './types'

export interface ResolvedCell {
  rowId: string
  value: CellValue
}

export interface ScatterPoint {
  rowId: string
  x: number
  y: number
  yError: number | null
}

export interface ResolvedScatterSeries {
  points: ScatterPoint[]
  skippedXYRowIds: string[]
  invalidErrorRowIds: string[]
  showYErrorBars: boolean
}

export type BarCategory = number | string

export interface BarPoint {
  sourceId: string
  /** Kept as a compatibility alias for column-oriented consumers. */
  rowId: string
  category: BarCategory
  value: number
  error: number | null
}

export interface ResolvedBarSeries {
  points: BarPoint[]
  skippedSourceIds: string[]
  invalidErrorSourceIds: string[]
  skippedRowIds: string[]
  invalidErrorRowIds: string[]
  showErrorBars: boolean
}

function emptyBarSeries(): ResolvedBarSeries {
  return {
    points: [],
    skippedSourceIds: [],
    invalidErrorSourceIds: [],
    skippedRowIds: [],
    invalidErrorRowIds: [],
    showErrorBars: false,
  }
}

function findDataset(
  datasets: DatasetModel[],
  datasetId: string,
): DatasetModel | undefined {
  return datasets.find((dataset) => dataset.id === datasetId)
}

export function resolveDataRange(
  datasets: DatasetModel[],
  binding: DataRangeRef,
): ResolvedCell[] {
  const dataset = findDataset(datasets, binding.datasetId)
  if (!dataset) return []

  let rows = dataset.rows
  if (binding.rows.kind === 'range') {
    const range = binding.rows
    const startIndex = rows.findIndex((row) => row.id === range.startRowId)
    const endIndex = rows.findIndex((row) => row.id === range.endRowId)
    if (startIndex < 0 || endIndex < startIndex) return []
    rows = rows.slice(startIndex, endIndex + 1)
  }

  return rows.map((row) => ({
    rowId: row.id,
    value: row.cells[binding.columnId] ?? null,
  }))
}

export function resolveScatterSeries(
  project: ProjectState,
  series: SeriesModel,
): ResolvedScatterSeries {
  if (!series.bindings.x || !series.bindings.y) {
    return {
      points: [],
      skippedXYRowIds: [],
      invalidErrorRowIds: [],
      showYErrorBars: false,
    }
  }

  const xCells = resolveDataRange(project.datasets, series.bindings.x)
  const yCells = resolveDataRange(project.datasets, series.bindings.y)
  const errorSource = series.errorBars.y.value?.source
  const errorCells =
    series.errorBars.y.enabled && errorSource
      ? resolveDataRange(project.datasets, errorSource)
      : null

  const count = Math.min(xCells.length, yCells.length)
  const points: ScatterPoint[] = []
  const skippedXYRowIds: string[] = []
  const invalidErrorRowIds: string[] = []

  for (let index = 0; index < count; index += 1) {
    const xCell = xCells[index]
    const yCell = yCells[index]
    if (
      typeof xCell.value !== 'number' ||
      !Number.isFinite(xCell.value) ||
      typeof yCell.value !== 'number' ||
      !Number.isFinite(yCell.value)
    ) {
      skippedXYRowIds.push(xCell.rowId)
      continue
    }

    let yError: number | null = null
    if (errorCells) {
      const errorValue = errorCells[index]?.value ?? null
      if (
        typeof errorValue === 'number' &&
        Number.isFinite(errorValue) &&
        errorValue >= 0
      ) {
        yError = errorValue
      } else {
        invalidErrorRowIds.push(xCell.rowId)
      }
    }

    points.push({ rowId: xCell.rowId, x: xCell.value, y: yCell.value, yError })
  }

  const showYErrorBars =
    errorCells !== null && invalidErrorRowIds.length === 0

  return { points, skippedXYRowIds, invalidErrorRowIds, showYErrorBars }
}

function isBarCategory(value: CellValue): value is BarCategory {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

export function resolveBarSeries(
  project: ProjectState,
  series: SeriesModel,
): ResolvedBarSeries {
  return project.chart.dataOrientation === 'rows'
    ? resolveRowOrientedBarSeries(project, series)
    : resolveColumnOrientedBarSeries(project, series)
}

function resolveColumnOrientedBarSeries(
  project: ProjectState,
  series: SeriesModel,
): ResolvedBarSeries {
  const { category, value, error } = series.barBindings
  if (!category || !value) return emptyBarSeries()

  const categoryCells = resolveDataRange(project.datasets, category)
  const valueCells = resolveDataRange(project.datasets, value)
  const errorCells = error ? resolveDataRange(project.datasets, error) : null
  const count = Math.min(categoryCells.length, valueCells.length)
  const points: BarPoint[] = []
  const skippedRowIds: string[] = []
  const invalidErrorRowIds: string[] = []

  for (let index = 0; index < count; index += 1) {
    const categoryCell = categoryCells[index]
    const valueCell = valueCells[index]
    if (
      !isBarCategory(categoryCell.value) ||
      typeof valueCell.value !== 'number' ||
      !Number.isFinite(valueCell.value)
    ) {
      skippedRowIds.push(categoryCell.rowId)
      continue
    }

    let errorValue: number | null = null
    if (errorCells) {
      const candidate = errorCells[index]?.value ?? null
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate >= 0
      ) {
        errorValue = candidate
      } else {
        invalidErrorRowIds.push(categoryCell.rowId)
      }
    }

    points.push({
      sourceId: categoryCell.rowId,
      rowId: categoryCell.rowId,
      category: categoryCell.value,
      value: valueCell.value,
      error: errorValue,
    })
  }

  return {
    points,
    skippedSourceIds: skippedRowIds,
    invalidErrorSourceIds: invalidErrorRowIds,
    skippedRowIds,
    invalidErrorRowIds,
    showErrorBars: errorCells !== null && invalidErrorRowIds.length === 0,
  }
}

function resolveRowOrientedBarSeries(
  project: ProjectState,
  series: SeriesModel,
): ResolvedBarSeries {
  const binding = series.barRowBindings
  if (
    !binding.datasetId ||
    !binding.categoryStartColumnId ||
    !binding.categoryEndColumnId ||
    !binding.valueRowId
  ) {
    return emptyBarSeries()
  }

  const dataset = findDataset(project.datasets, binding.datasetId)
  if (!dataset) return emptyBarSeries()
  const startIndex = dataset.columns.findIndex(
    (column) => column.id === binding.categoryStartColumnId,
  )
  const endIndex = dataset.columns.findIndex(
    (column) => column.id === binding.categoryEndColumnId,
  )
  const valueRow = dataset.rows.find((row) => row.id === binding.valueRowId)
  const errorRow = binding.errorRowId
    ? dataset.rows.find((row) => row.id === binding.errorRowId)
    : null
  if (startIndex < 0 || endIndex < startIndex || !valueRow) {
    return emptyBarSeries()
  }
  if (binding.errorRowId && !errorRow) return emptyBarSeries()

  const points: BarPoint[] = []
  const skippedSourceIds: string[] = []
  const invalidErrorSourceIds: string[] = []
  const categoryColumns = dataset.columns.slice(startIndex, endIndex + 1)

  for (const column of categoryColumns) {
    const category = column.name
    const value = valueRow.cells[column.id] ?? null
    if (!isBarCategory(category) || typeof value !== 'number' || !Number.isFinite(value)) {
      skippedSourceIds.push(column.id)
      continue
    }

    let error: number | null = null
    if (errorRow) {
      const candidate = errorRow.cells[column.id] ?? null
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate >= 0
      ) {
        error = candidate
      } else {
        invalidErrorSourceIds.push(column.id)
      }
    }

    points.push({
      sourceId: column.id,
      rowId: column.id,
      category,
      value,
      error,
    })
  }

  return {
    points,
    skippedSourceIds,
    invalidErrorSourceIds,
    skippedRowIds: skippedSourceIds,
    invalidErrorRowIds: invalidErrorSourceIds,
    showErrorBars: errorRow !== null && invalidErrorSourceIds.length === 0,
  }
}

export function formatDataRowLabel(
  dataset: DatasetModel,
  row: RowModel,
  rowIndex: number,
  labelColumnId: string | null,
): string {
  const validLabelColumnId = labelColumnId &&
    dataset.columns.some((column) => column.id === labelColumnId)
    ? labelColumnId
    : null
  const label = validLabelColumnId
    ? row.cells[validLabelColumnId] ?? null
    : null
  const suffix = label === null || String(label).trim() === ''
    ? ''
    : `（${String(label)}）`
  return `${rowIndex + 2}行目${suffix}`
}

export function isCategoryAxis(
  project: ProjectState,
  dimension: 'x' | 'y',
): boolean {
  if (project.chart.type !== 'bar') return false
  return project.chart.bar.orientation === 'vertical'
    ? dimension === 'x'
    : dimension === 'y'
}

export function isNumericAxis(
  project: ProjectState,
  dimension: 'x' | 'y',
): boolean {
  return !isCategoryAxis(project, dimension)
}
