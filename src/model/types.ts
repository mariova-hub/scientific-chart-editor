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
export type AxisScaleType = 'linear' | 'log'
export type TickDirection = 'inside' | 'outside' | 'cross' | 'none'
export type MarkerShape =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle-up'
  | 'cross'
  | 'x'
export type LineStyle = 'solid' | 'dash' | 'dot' | 'dash-dot'
export type LegendPosition = 'right' | 'left' | 'top' | 'bottom'
export type ChartType = 'scatter' | 'bar'
export type BarOrientation = 'vertical' | 'horizontal'
export type DataOrientation = 'columns' | 'rows'

export interface BarRowBindings {
  datasetId: string | null
  categoryStartColumnId: string | null
  categoryEndColumnId: string | null
  valueRowId: string | null
  errorRowId: string | null
  labelColumnId: string | null
}

export type MajorInterval =
  | { mode: 'auto' }
  | { mode: 'fixed'; step: number }

export type MinorInterval =
  | { mode: 'none' }
  | { mode: 'auto' }
  | { mode: 'fixed'; step: number }

export interface FontStyleModel {
  family: string
  sizePx: number
  color: string
}

export interface LineAppearanceModel {
  visible: boolean
  color: string
  widthPx: number
}

export interface AxisModel {
  id: string
  dimension: AxisDimension
  position: AxisPosition
  title: { visible: boolean; text: string }
  scale: {
    type: AxisScaleType
    minimum: number | null
    maximum: number | null
    reversed: boolean
  }
  ticks: {
    majorInterval: MajorInterval
    minorInterval: MinorInterval
    majorVisible: boolean
    minorVisible: boolean
    direction: TickDirection
  }
  gridLines: {
    majorVisible: boolean
    minorVisible: boolean
  }
  line: LineAppearanceModel
  labels: FontStyleModel
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
  style: {
    visible: boolean
    color: string
    widthPx: number
    capSizePx: number
  }
}

export interface SeriesModel {
  id: string
  name: string
  visible: boolean
  bindings: {
    x: DataRangeRef | null
    y: DataRangeRef | null
  }
  barBindings: {
    category: DataRangeRef | null
    value: DataRangeRef | null
    error: DataRangeRef | null
  }
  barRowBindings: BarRowBindings
  axisIds: { x: string; y: string }
  style: {
    color: string
    line: {
      visible: boolean
      color: string
      widthPx: number
      dash: LineStyle
    }
    marker: {
      visible: boolean
      shape: MarkerShape
      sizePx: number
      fillColor: string
      borderColor: string
      borderWidthPx: number
    }
    bar: {
      fillColor: string
      borderColor: string
      borderWidthPx: number
      opacity: number
      widthRatio: number
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
  type: ChartType
  dataOrientation: DataOrientation
  bar: {
    orientation: BarOrientation
    gapRatio: number
  }
  title: {
    visible: boolean
    text: string
    style: FontStyleModel & { bold: boolean }
  }
  legend: { visible: boolean; position: LegendPosition }
  size: { widthPx: number; heightPx: number }
  style: {
    backgroundColor: string
    plotBackgroundColor: string
  }
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
