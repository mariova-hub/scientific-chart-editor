import type {
  CellValue,
  DataRangeRef,
  DatasetModel,
  ProjectState,
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
