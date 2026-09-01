import type {
  AxisDimension,
  AxisModel,
  DataRangeRef,
  DatasetModel,
  ProjectState,
} from './types'
import {
  DEFAULT_AXIS_TITLE_DISTANCE_PX,
  defaultAxisLabels,
  defaultAxisLine,
  defaultAxisTickStyle,
  defaultAxisTitleStyle,
  defaultBarOptions,
  defaultBarRowBindings,
  defaultBarStyle,
  defaultChartStyle,
  defaultErrorBarStyle,
  defaultLineStyle,
  defaultMarkerStyle,
  defaultMajorGridStyle,
  defaultMinorGridStyle,
  defaultPlotArea,
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
    title: {
      visible: true,
      text: dimension === 'x' ? 'X' : 'Y',
      distancePx: DEFAULT_AXIS_TITLE_DISTANCE_PX,
      style: defaultAxisTitleStyle(),
    },
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
      ...defaultAxisTickStyle(),
    },
    gridLines: {
      majorVisible: true,
      minorVisible: false,
      majorStyle: defaultMajorGridStyle(),
      minorStyle: defaultMinorGridStyle(),
    },
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
      dataOrientation: 'columns',
      bar: defaultBarOptions(),
      title: {
        visible: true,
        text: 'Scientific chart',
        style: defaultTitleStyle(),
      },
      legend: { visible: false, position: 'right' },
      size: { widthPx: 760, heightPx: 480 },
      style: defaultChartStyle(),
      plotArea: defaultPlotArea(),
      axes: [xAxis, yAxis],
      series: [
        {
          id: idFactory(),
          name: 'Series 1',
          visible: true,
          bindings: { x: null, y: null },
          barBindings: { category: null, value: null, error: null },
          barRowBindings: defaultBarRowBindings(),
          axisIds: { x: xAxis.id, y: yAxis.id },
          style: {
            color: '#2563eb',
            line: defaultLineStyle(),
            marker: defaultMarkerStyle(),
            bar: defaultBarStyle(),
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
          barBindings: {
            category: xColumn ? createDataRange(dataset.id, xColumn.id) : null,
            value: yColumn ? createDataRange(dataset.id, yColumn.id) : null,
            error: null,
          },
          barRowBindings: defaultBarRowBindings(),
          errorBars: {
            ...series.errorBars,
            y: { ...series.errorBars.y, enabled: false, value: null },
          },
        },
      ],
    },
  }
}
