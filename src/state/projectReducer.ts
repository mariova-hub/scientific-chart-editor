import { createDataRange, projectWithDataset } from '../model/createProject'
import type {
  AxisScaleType,
  DatasetModel,
  FontStyleModel,
  LegendPosition,
  LineStyle,
  MarkerShape,
  ProjectState,
  TickDirection,
} from '../model/types'

export type ProjectAction =
  | { type: 'replace-dataset'; dataset: DatasetModel }
  | { type: 'set-binding'; role: 'x' | 'y' | 'yError'; columnId: string | null }
  | { type: 'set-axis-title'; axisId: string; title: string }
  | {
      type: 'set-axis-bound'
      axisId: string
      bound: 'minimum' | 'maximum'
      value: number | null
    }
  | { type: 'set-axis-major-unit'; axisId: string; value: number | null }
  | { type: 'set-axis-minor-unit'; axisId: string; value: number | null }
  | {
      type: 'set-axis-tick-visible'
      axisId: string
      kind: 'major' | 'minor'
      visible: boolean
    }
  | { type: 'set-axis-tick-direction'; axisId: string; value: TickDirection }
  | { type: 'set-axis-scale-type'; axisId: string; value: AxisScaleType }
  | { type: 'set-axis-reversed'; axisId: string; value: boolean }
  | {
      type: 'set-axis-line'
      axisId: string
      field: 'visible' | 'color' | 'widthPx'
      value: boolean | string | number
    }
  | {
      type: 'set-axis-grid-visible'
      axisId: string
      kind: 'major' | 'minor'
      visible: boolean
    }
  | {
      type: 'set-axis-label-style'
      axisId: string
      field: keyof FontStyleModel
      value: string | number
    }
  | { type: 'set-chart-title-text'; value: string }
  | { type: 'set-chart-title-visible'; value: boolean }
  | {
      type: 'set-chart-title-style'
      field: keyof ProjectState['chart']['title']['style']
      value: string | number | boolean
    }
  | {
      type: 'set-chart-size'
      dimension: 'widthPx' | 'heightPx'
      value: number
    }
  | { type: 'set-chart-size-complete'; widthPx: number; heightPx: number }
  | {
      type: 'set-chart-background'
      field: 'backgroundColor' | 'plotBackgroundColor'
      value: string
    }
  | {
      type: 'set-series-marker'
      seriesId: string
      field:
        | 'visible'
        | 'shape'
        | 'sizePx'
        | 'fillColor'
        | 'borderColor'
        | 'borderWidthPx'
      value: boolean | MarkerShape | number | string
    }
  | {
      type: 'set-series-line'
      seriesId: string
      field: 'visible' | 'color' | 'widthPx' | 'dash'
      value: boolean | string | number | LineStyle
    }
  | {
      type: 'set-error-bar-style'
      seriesId: string
      field: 'visible' | 'color' | 'widthPx' | 'capSizePx'
      value: boolean | string | number
    }
  | { type: 'set-legend-visible'; value: boolean }
  | { type: 'set-legend-position'; value: LegendPosition }
  | { type: 'load-project'; project: ProjectState }

function touched(project: ProjectState): ProjectState {
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
  }
}

function withChart(project: ProjectState, chart: ProjectState['chart']) {
  return touched({ ...project, chart })
}

export function projectReducer(
  project: ProjectState,
  action: ProjectAction,
): ProjectState {
  if (action.type === 'load-project') return action.project
  if (action.type === 'replace-dataset') {
    return projectWithDataset(project, action.dataset)
  }

  const dataset = project.datasets[0]
  const firstSeries = project.chart.series[0]

  if (action.type === 'set-binding') {
    if (!dataset || !firstSeries) return project
    const binding = action.columnId
      ? createDataRange(dataset.id, action.columnId)
      : null
    const nextSeries =
      action.role === 'yError'
        ? {
            ...firstSeries,
            errorBars: {
              ...firstSeries.errorBars,
              y: {
                ...firstSeries.errorBars.y,
                enabled: binding !== null,
                value: binding
                  ? ({ kind: 'symmetric', source: binding } as const)
                  : null,
              },
            },
          }
        : {
            ...firstSeries,
            name:
              action.role === 'y' && action.columnId
                ? dataset.columns.find((column) => column.id === action.columnId)
                    ?.name || firstSeries.name
                : firstSeries.name,
            bindings: { ...firstSeries.bindings, [action.role]: binding },
          }
    return withChart(project, { ...project.chart, series: [nextSeries] })
  }

  if (action.type === 'set-chart-title-text') {
    return withChart(project, {
      ...project.chart,
      title: { ...project.chart.title, text: action.value },
    })
  }
  if (action.type === 'set-chart-title-visible') {
    return withChart(project, {
      ...project.chart,
      title: { ...project.chart.title, visible: action.value },
    })
  }
  if (action.type === 'set-chart-title-style') {
    return withChart(project, {
      ...project.chart,
      title: {
        ...project.chart.title,
        style: { ...project.chart.title.style, [action.field]: action.value },
      },
    })
  }
  if (action.type === 'set-chart-size') {
    return withChart(project, {
      ...project.chart,
      size: { ...project.chart.size, [action.dimension]: action.value },
    })
  }
  if (action.type === 'set-chart-size-complete') {
    return withChart(project, {
      ...project.chart,
      size: { widthPx: action.widthPx, heightPx: action.heightPx },
    })
  }
  if (action.type === 'set-chart-background') {
    return withChart(project, {
      ...project.chart,
      style: { ...project.chart.style, [action.field]: action.value },
    })
  }
  if (action.type === 'set-legend-visible') {
    return withChart(project, {
      ...project.chart,
      legend: { ...project.chart.legend, visible: action.value },
    })
  }
  if (action.type === 'set-legend-position') {
    return withChart(project, {
      ...project.chart,
      legend: { ...project.chart.legend, position: action.value },
    })
  }
  if (action.type === 'set-series-marker') {
    return withChart(project, {
      ...project.chart,
      series: project.chart.series.map((series) =>
        series.id === action.seriesId
          ? {
              ...series,
              style: {
                ...series.style,
                marker: {
                  ...series.style.marker,
                  [action.field]: action.value,
                },
              },
            }
          : series,
      ),
    })
  }
  if (action.type === 'set-series-line') {
    return withChart(project, {
      ...project.chart,
      series: project.chart.series.map((series) =>
        series.id === action.seriesId
          ? {
              ...series,
              style: {
                ...series.style,
                line: {
                  ...series.style.line,
                  [action.field]: action.value,
                },
              },
            }
          : series,
      ),
    })
  }
  if (action.type === 'set-error-bar-style') {
    return withChart(project, {
      ...project.chart,
      series: project.chart.series.map((series) =>
        series.id === action.seriesId
          ? {
              ...series,
              errorBars: {
                ...series.errorBars,
                y: {
                  ...series.errorBars.y,
                  style: {
                    ...series.errorBars.y.style,
                    [action.field]: action.value,
                  },
                },
              },
            }
          : series,
      ),
    })
  }

  if (!('axisId' in action)) return project
  const axes = project.chart.axes.map((axis) => {
    if (axis.id !== action.axisId) return axis
    if (action.type === 'set-axis-title') {
      return { ...axis, title: { ...axis.title, text: action.title } }
    }
    if (action.type === 'set-axis-bound') {
      return {
        ...axis,
        scale: { ...axis.scale, [action.bound]: action.value },
      }
    }
    if (action.type === 'set-axis-major-unit') {
      return {
        ...axis,
        ticks: {
          ...axis.ticks,
          majorInterval:
            action.value === null
              ? ({ mode: 'auto' } as const)
              : ({ mode: 'fixed', step: action.value } as const),
        },
      }
    }
    if (action.type === 'set-axis-minor-unit') {
      return {
        ...axis,
        ticks: {
          ...axis.ticks,
          minorInterval:
            action.value === null
              ? ({ mode: 'auto' } as const)
              : ({ mode: 'fixed', step: action.value } as const),
        },
      }
    }
    if (action.type === 'set-axis-tick-visible') {
      const key = action.kind === 'major' ? 'majorVisible' : 'minorVisible'
      return {
        ...axis,
        ticks: {
          ...axis.ticks,
          [key]: action.visible,
          ...(action.kind === 'minor' &&
          action.visible &&
          axis.ticks.minorInterval.mode === 'none'
            ? { minorInterval: { mode: 'auto' } as const }
            : {}),
        },
      }
    }
    if (action.type === 'set-axis-tick-direction') {
      return { ...axis, ticks: { ...axis.ticks, direction: action.value } }
    }
    if (action.type === 'set-axis-scale-type') {
      return { ...axis, scale: { ...axis.scale, type: action.value } }
    }
    if (action.type === 'set-axis-reversed') {
      return { ...axis, scale: { ...axis.scale, reversed: action.value } }
    }
    if (action.type === 'set-axis-line') {
      return { ...axis, line: { ...axis.line, [action.field]: action.value } }
    }
    if (action.type === 'set-axis-grid-visible') {
      const key = action.kind === 'major' ? 'majorVisible' : 'minorVisible'
      return {
        ...axis,
        gridLines: { ...axis.gridLines, [key]: action.visible },
      }
    }
    if (action.type === 'set-axis-label-style') {
      return {
        ...axis,
        labels: { ...axis.labels, [action.field]: action.value },
      }
    }
    return axis
  })
  return withChart(project, { ...project.chart, axes })
}
