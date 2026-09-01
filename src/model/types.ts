export type CellValue = number | string | null

export interface ColumnModel {
  id: string
  name: string
}

export interface RowModel {
  id: string
  cells: Record<string, CellValue>
}

export interface DatasetModel {
  id: string
  name: string
  columns: ColumnModel[]
  rows: RowModel[]
  extensions?: Record<string, unknown>
}

export type RowSelection =
  | { kind: 'all' }
  | { kind: 'range'; startRowId: string; endRowId: string }

export interface DataRangeRef {
  datasetId: string
  columnId: string
  rows: RowSelection
}

export type AxisDimension = 'x' | 'y'
export type AxisPosition = 'bottom' | 'left'

export type MajorInterval =
  | { mode: 'auto' }
  | { mode: 'fixed'; step: number }

export interface AxisModel {
  id: string
  dimension: AxisDimension
  position: AxisPosition
  title: { visible: boolean; text: string }
  scale: {
    type: 'linear'
    minimum: number | null
    maximum: number | null
    reversed: boolean
  }
  ticks: {
    majorInterval: MajorInterval
    minorInterval: { mode: 'none' }
    direction: 'outside'
  }
  gridLines: {
    majorVisible: boolean
    minorVisible: boolean
  }
  numberFormat: { kind: 'auto' }
  extensions?: Record<string, unknown>
}

export interface SymmetricErrorValue {
  kind: 'symmetric'
  source: DataRangeRef
}

export interface ErrorBarModel {
  enabled: boolean
  value: SymmetricErrorValue | null
}

export interface SeriesModel {
  id: string
  name: string
  visible: boolean
  bindings: {
    x: DataRangeRef | null
    y: DataRangeRef | null
  }
  axisIds: { x: string; y: string }
  style: {
    color: string
    line: { visible: boolean; widthPx: number; dash: 'solid' }
    marker: { visible: boolean; shape: 'circle'; sizePx: number }
    bar: {
      fillColor: string
      borderColor: string
      borderWidthPx: number
    }
  }
  errorBars: {
    x: ErrorBarModel
    y: ErrorBarModel
  }
  trendlines: []
  extensions?: Record<string, unknown>
}

export interface ChartModel {
  id: string
  type: 'scatter'
  title: { visible: boolean; text: string }
  legend: { visible: boolean; position: 'right' }
  size: { widthPx: number; heightPx: number }
  axes: AxisModel[]
  series: SeriesModel[]
  annotations: []
  extensions?: Record<string, unknown>
}

export interface ProjectState {
  id: string
  metadata: {
    title: string
    createdAt: string
    updatedAt: string
  }
  datasets: DatasetModel[]
  chart: ChartModel
  extensions?: Record<string, unknown>
}

export interface ProjectFileV01 {
  schemaVersion: '0.1'
  app: 'scientific-chart-editor'
  project: ProjectState
}

export interface ValidationIssue {
  code: string
  path: string
  message: string
}
