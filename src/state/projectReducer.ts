import { createDataRange, projectWithDataset } from '../model/createProject'
import type {
  AxisDimension,
  DatasetModel,
  ProjectState,
} from '../model/types'

export type ProjectAction =
  | { type: 'replace-dataset'; dataset: DatasetModel }
  | { type: 'set-binding'; role: 'x' | 'y' | 'yError'; columnId: string | null }
  | { type: 'set-axis-title'; dimension: AxisDimension; title: string }
  | {
      type: 'set-axis-bound'
      dimension: AxisDimension
      bound: 'minimum' | 'maximum'
      value: number | null
    }
  | { type: 'set-axis-major-unit'; dimension: AxisDimension; value: number | null }
  | { type: 'set-chart-title'; title: string }
  | { type: 'set-chart-size'; dimension: 'widthPx' | 'heightPx'; value: number }
  | { type: 'load-project'; project: ProjectState }

function touched(project: ProjectState): ProjectState {
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
  }
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
  const series = project.chart.series[0]
  if (!dataset || !series) return project

  if (action.type === 'set-binding') {
    const binding = action.columnId
      ? createDataRange(dataset.id, action.columnId)
      : null
    const nextSeries =
      action.role === 'yError'
        ? {
            ...series,
            errorBars: {
              ...series.errorBars,
              y: {
                enabled: binding !== null,
                value: binding
                  ? ({ kind: 'symmetric', source: binding } as const)
                  : null,
              },
            },
          }
        : {
            ...series,
            name:
              action.role === 'y' && action.columnId
                ? dataset.columns.find((column) => column.id === action.columnId)
                    ?.name || series.name
                : series.name,
            bindings: { ...series.bindings, [action.role]: binding },
          }
    return touched({
      ...project,
      chart: { ...project.chart, series: [nextSeries] },
    })
  }

  if (action.type === 'set-chart-title') {
    return touched({
      ...project,
      chart: {
        ...project.chart,
        title: { ...project.chart.title, text: action.title },
      },
    })
  }

  if (action.type === 'set-chart-size') {
    return touched({
      ...project,
      chart: {
        ...project.chart,
        size: { ...project.chart.size, [action.dimension]: action.value },
      },
    })
  }

  const axes = project.chart.axes.map((axis) => {
    if (axis.dimension !== action.dimension) return axis
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
    return axis
  })

  return touched({ ...project, chart: { ...project.chart, axes } })
}
