import { createDataRange, projectWithDataset } from '../model/createProject'
import type {
  AxisModel,
  AxisScaleType,
  AxisNumberFormat,
  BarOrientation,
  ChartType,
  DataOrientation,
  DatasetModel,
  GridLineStyle,
  LegendPosition,
  LineStyle,
  MarkerShape,
  ProjectState,
  TickDirection,
} from '../model/types'

export type ProjectAction =
  | { type: 'replace-dataset'; dataset: DatasetModel }
  | { type: 'paste-range'; dataset: DatasetModel }
  | { type: 'edit-cell'; dataset: DatasetModel }
  | { type: 'clear-cell'; dataset: DatasetModel }
  | {
      type: 'set-binding'
      role: 'x' | 'y' | 'yError' | 'category' | 'value' | 'barError'
      columnId: string | null
    }
  | { type: 'set-chart-type'; value: ChartType }
  | { type: 'set-data-orientation'; value: DataOrientation }
  | {
      type: 'set-row-category-bound'
      bound: 'start' | 'end'
      columnId: string | null
    }
  | {
      type: 'set-row-binding'
      role: 'value' | 'error'
      rowId: string | null
    }
  | { type: 'set-row-label-column'; columnId: string | null }
  | { type: 'set-bar-orientation'; value: BarOrientation }
  | { type: 'set-bar-gap-percent'; value: number }
  | { type: 'set-axis-title'; axisId: string; title: string }
  | { type: 'set-axis-title-visible'; axisId: string; visible: boolean }
  | { type: 'set-axis-title-distance'; axisId: string; value: number }
  | {
      type: 'set-axis-title-style'
      axisId: string
      field: keyof AxisModel['title']['style']
      value: string | number | boolean
    }
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
  | {
      type: 'set-axis-tick-style'
      axisId: string
      field: 'majorLengthPx' | 'minorLengthPx' | 'lineWidthPx'
      value: number
    }
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
      type: 'set-axis-grid-style'
      axisId: string
      kind: 'major' | 'minor'
      field: 'color' | 'widthPx' | 'style'
      value: string | number | GridLineStyle
    }
  | {
      type: 'set-axis-label-style'
      axisId: string
      field: keyof AxisModel['labels']
      value: string | number | boolean
    }
  | { type: 'set-axis-number-format'; axisId: string; value: AxisNumberFormat }
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
      type: 'set-plot-area-border'
      field: 'visible' | 'color' | 'widthPx'
      value: boolean | string | number
    }
  | { type: 'set-plot-margin-mode'; value: 'auto' | 'manual' }
  | {
      type: 'set-plot-margin'
      field: 'topPx' | 'rightPx' | 'bottomPx' | 'leftPx'
      value: number
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
      type: 'set-series-bar'
      seriesId: string
      field: 'fillColor' | 'borderColor' | 'borderWidthPx' | 'opacity'
      value: string | number
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
  if (
    action.type === 'paste-range' ||
    action.type === 'edit-cell' ||
    action.type === 'clear-cell'
  ) {
    return project.datasets.length === 0
      ? projectWithDataset(project, action.dataset)
      : touched({ ...project, datasets: [action.dataset] })
  }

  const dataset = project.datasets[0]
  const firstSeries = project.chart.series[0]

  if (action.type === 'set-data-orientation') {
    if (!firstSeries || (action.value === 'rows' && project.chart.type !== 'bar')) {
      return project
    }
    const nextSeries = action.value === 'rows' && dataset
      ? {
          ...firstSeries,
          barRowBindings: {
            ...firstSeries.barRowBindings,
            datasetId: dataset.id,
            labelColumnId:
              firstSeries.barRowBindings.labelColumnId ??
              dataset.columns[0]?.id ??
              null,
          },
        }
      : firstSeries
    return withChart(project, {
      ...project.chart,
      dataOrientation: action.value,
      series: [nextSeries],
    })
  }

  if (action.type === 'set-row-category-bound') {
    if (!dataset || !firstSeries) return project
    const key = action.bound === 'start'
      ? 'categoryStartColumnId'
      : 'categoryEndColumnId'
    const nextSeries = {
      ...firstSeries,
      barRowBindings: {
        ...firstSeries.barRowBindings,
        datasetId: dataset.id,
        [key]: action.columnId,
      },
    }
    return withChart(project, { ...project.chart, series: [nextSeries] })
  }

  if (action.type === 'set-row-binding') {
    if (!dataset || !firstSeries) return project
    const key = action.role === 'value' ? 'valueRowId' : 'errorRowId'
    const labelColumnId = firstSeries.barRowBindings.labelColumnId
    const row = action.rowId
      ? dataset.rows.find((candidate) => candidate.id === action.rowId)
      : undefined
    const label = row && labelColumnId
      ? row.cells[labelColumnId] ?? null
      : null
    const nextSeries = {
      ...firstSeries,
      ...(action.role === 'value' && label !== null
        ? { name: String(label) }
        : {}),
      barRowBindings: {
        ...firstSeries.barRowBindings,
        datasetId: dataset.id,
        [key]: action.rowId,
      },
    }
    return withChart(project, { ...project.chart, series: [nextSeries] })
  }

  if (action.type === 'set-row-label-column') {
    if (!dataset || !firstSeries) return project
    const nextSeries = {
      ...firstSeries,
      barRowBindings: {
        ...firstSeries.barRowBindings,
        datasetId: dataset.id,
        labelColumnId: action.columnId,
      },
    }
    return withChart(project, { ...project.chart, series: [nextSeries] })
  }

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
        : action.role === 'category' ||
            action.role === 'value' ||
            action.role === 'barError'
          ? {
              ...firstSeries,
              name:
                action.role === 'value' && action.columnId
                  ? dataset.columns.find((column) => column.id === action.columnId)
                      ?.name || firstSeries.name
                  : firstSeries.name,
              barBindings: {
                ...firstSeries.barBindings,
                [action.role === 'barError' ? 'error' : action.role]: binding,
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

  if (action.type === 'set-chart-type') {
    if (!firstSeries) return project
    const nextSeries = action.value === 'bar'
      ? {
        ...firstSeries,
        barBindings: {
          category: firstSeries.barBindings.category ?? firstSeries.bindings.x,
          value: firstSeries.barBindings.value ?? firstSeries.bindings.y,
          error:
            firstSeries.barBindings.error ??
            firstSeries.errorBars.y.value?.source ??
            null,
        },
        }
      : {
        ...firstSeries,
        bindings: {
          x: firstSeries.bindings.x ?? firstSeries.barBindings.category,
          y: firstSeries.bindings.y ?? firstSeries.barBindings.value,
        },
        errorBars: {
          ...firstSeries.errorBars,
          y: {
            ...firstSeries.errorBars.y,
            enabled:
              firstSeries.errorBars.y.enabled ||
              firstSeries.barBindings.error !== null,
            value:
              firstSeries.errorBars.y.value ??
              (firstSeries.barBindings.error
                ? { kind: 'symmetric', source: firstSeries.barBindings.error }
                : null),
          },
        },
        }
    return withChart(project, {
      ...project.chart,
      type: action.value,
      dataOrientation:
        action.value === 'scatter' ? 'columns' : project.chart.dataOrientation,
      series: [nextSeries],
    })
  }
  if (action.type === 'set-bar-orientation') {
    return withChart(project, {
      ...project.chart,
      bar: { ...project.chart.bar, orientation: action.value },
    })
  }
  if (action.type === 'set-bar-gap-percent') {
    return withChart(project, {
      ...project.chart,
      bar: { ...project.chart.bar, gapPercent: action.value },
    })
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
  if (action.type === 'set-plot-area-border') {
    return withChart(project, {
      ...project.chart,
      plotArea: {
        ...project.chart.plotArea,
        border: {
          ...project.chart.plotArea.border,
          [action.field]: action.value,
        },
      },
    })
  }
  if (action.type === 'set-plot-margin-mode') {
    return withChart(project, {
      ...project.chart,
      plotArea: {
        ...project.chart.plotArea,
        margin: { ...project.chart.plotArea.margin, mode: action.value },
      },
    })
  }
  if (action.type === 'set-plot-margin') {
    return withChart(project, {
      ...project.chart,
      plotArea: {
        ...project.chart.plotArea,
        margin: {
          ...project.chart.plotArea.margin,
          [action.field]: action.value,
        },
      },
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
  if (action.type === 'set-series-bar') {
    return withChart(project, {
      ...project.chart,
      series: project.chart.series.map((series) =>
        series.id === action.seriesId
          ? {
              ...series,
              style: {
                ...series.style,
                bar: {
                  ...series.style.bar,
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
    if (action.type === 'set-axis-title-visible') {
      return { ...axis, title: { ...axis.title, visible: action.visible } }
    }
    if (action.type === 'set-axis-title-distance') {
      return { ...axis, title: { ...axis.title, distancePx: action.value } }
    }
    if (action.type === 'set-axis-title-style') {
      return {
        ...axis,
        title: {
          ...axis.title,
          style: { ...axis.title.style, [action.field]: action.value },
        },
      }
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
    if (action.type === 'set-axis-tick-style') {
      return {
        ...axis,
        ticks: { ...axis.ticks, [action.field]: action.value },
      }
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
    if (action.type === 'set-axis-grid-style') {
      const key = action.kind === 'major' ? 'majorStyle' : 'minorStyle'
      return {
        ...axis,
        gridLines: {
          ...axis.gridLines,
          [key]: {
            ...axis.gridLines[key],
            [action.field]: action.value,
          },
        },
      }
    }
    if (action.type === 'set-axis-label-style') {
      return {
        ...axis,
        labels: { ...axis.labels, [action.field]: action.value },
      }
    }
    if (action.type === 'set-axis-number-format') {
      return { ...axis, numberFormat: action.value }
    }
    return axis
  })
  return withChart(project, { ...project.chart, axes })
}
