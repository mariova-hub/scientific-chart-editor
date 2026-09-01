import type {
  AxisDimension,
  AxisModel,
  DataRangeRef,
  DatasetModel,
  ProjectState,
} from './types'
import {
  defaultAxisLabels,
  defaultAxisLine,
  defaultChartStyle,
  defaultErrorBarStyle,
  defaultLineStyle,
  defaultMarkerStyle,
  defaultTitleStyle,
} from './defaults'

export type IdFactory = () => string

export const randomId: IdFactory = () => crypto.randomUUID()

function createAxis(
  dimension: AxisDimension,
  idFactory: IdFactory,
): AxisModel {
  return {
    id: idFactory(),
    dimension,
    position: dimension === 'x' ? 'bottom' : 'left',
    title: { visible: true, text: dimension === 'x' ? 'X' : 'Y' },
    scale: {
      type: 'linear',
      minimum: null,
      maximum: null,
      reversed: false,
    },
    ticks: {
      majorInterval: { mode: 'auto' },
      minorInterval: { mode: 'none' },
      majorVisible: true,
      minorVisible: false,
      direction: 'outside',
    },
    gridLines: { majorVisible: true, minorVisible: false },
    line: defaultAxisLine(),
    labels: defaultAxisLabels(),
    numberFormat: { kind: 'auto' },
    extensions: {},
  }
}

export function createDataRange(
  datasetId: string,
  columnId: string,
): DataRangeRef {
  return { datasetId, columnId, rows: { kind: 'all' } }
}

export function createEmptyProject(
  idFactory: IdFactory = randomId,
  now = new Date().toISOString(),
): ProjectState {
  const xAxis = createAxis('x', idFactory)
  const yAxis = createAxis('y', idFactory)

  return {
    id: idFactory(),
    metadata: {
      title: 'Untitled scientific chart',
      createdAt: now,
      updatedAt: now,
    },
    datasets: [],
    chart: {
      id: idFactory(),
      type: 'scatter',
      title: {
        visible: true,
        text: 'Scientific chart',
        style: defaultTitleStyle(),
      },
      legend: { visible: false, position: 'right' },
      size: { widthPx: 760, heightPx: 480 },
      style: defaultChartStyle(),
      axes: [xAxis, yAxis],
      series: [
        {
          id: idFactory(),
          name: 'Series 1',
          visible: true,
          bindings: { x: null, y: null },
          axisIds: { x: xAxis.id, y: yAxis.id },
          style: {
            color: '#2563eb',
            line: defaultLineStyle(),
            marker: defaultMarkerStyle(),
            bar: {
              fillColor: '#2563eb',
              borderColor: '#1d4ed8',
              borderWidthPx: 1,
            },
          },
          errorBars: {
            x: {
              enabled: false,
              value: null,
              style: defaultErrorBarStyle(),
            },
            y: {
              enabled: false,
              value: null,
              style: defaultErrorBarStyle(),
            },
          },
          trendlines: [],
          extensions: {},
        },
      ],
      annotations: [],
      extensions: {},
    },
    extensions: {},
  }
}

export function projectWithDataset(
  project: ProjectState,
  dataset: DatasetModel,
  now = new Date().toISOString(),
): ProjectState {
  const series = project.chart.series[0]
  const xColumn = dataset.columns[0]
  const yColumn = dataset.columns[1]

  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    datasets: [dataset],
    chart: {
      ...project.chart,
      series: [
        {
          ...series,
          name: yColumn?.name || 'Series 1',
          bindings: {
            x: xColumn ? createDataRange(dataset.id, xColumn.id) : null,
            y: yColumn ? createDataRange(dataset.id, yColumn.id) : null,
          },
          errorBars: {
            ...series.errorBars,
            y: { ...series.errorBars.y, enabled: false, value: null },
          },
        },
      ],
    },
  }
}
