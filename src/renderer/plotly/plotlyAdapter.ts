import type { Config, Data, Layout, LayoutAxis } from 'plotly.js'
import { resolveScatterSeries } from '../../model/dataBinding'
import { CHART_SIZE_LIMITS } from '../../model/limits'
import type { AxisModel, ProjectState } from '../../model/types'

export interface PlotlyFigure {
  data: Data[]
  layout: Partial<Layout>
  config: Partial<Config>
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function dataExtent(values: number[]): [number, number] | null {
  if (values.length === 0) return null
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  if (minimum !== maximum) return [minimum, maximum]
  const padding = Math.abs(minimum) * 0.05 || 1
  return [minimum - padding, maximum + padding]
}

function axisRange(
  axis: AxisModel,
  values: number[],
): [number, number] | undefined {
  const extent = dataExtent(values)
  if (axis.scale.minimum === null && axis.scale.maximum === null) return undefined
  if (!extent) return undefined
  return [axis.scale.minimum ?? extent[0], axis.scale.maximum ?? extent[1]]
}

function toPlotlyAxis(axis: AxisModel, values: number[]): Partial<LayoutAxis> {
  const range = axisRange(axis, values)
  return {
    title: { text: axis.title.visible ? axis.title.text : '' },
    autorange: range ? false : true,
    range,
    dtick:
      axis.ticks.majorInterval.mode === 'fixed' &&
      axis.ticks.majorInterval.step > 0
        ? axis.ticks.majorInterval.step
        : undefined,
    showgrid: axis.gridLines.majorVisible,
    zeroline: false,
    ticks: 'outside',
    automargin: true,
  }
}

export function toPlotlyFigure(project: ProjectState): PlotlyFigure {
  const series = project.chart.series[0]
  const resolved = resolveScatterSeries(project, series)
  const x = resolved.points.map((point) => point.x)
  const y = resolved.points.map((point) => point.y)
  const pointsWithYErrors = resolved.points.filter(
    (point): point is typeof point & { yError: number } =>
      point.yError !== null,
  )
  const hasYErrors =
    resolved.showYErrorBars &&
    pointsWithYErrors.length === resolved.points.length
  const yErrors = pointsWithYErrors.map((point) => point.yError)
  const xAxis = project.chart.axes.find((axis) => axis.dimension === 'x')
  const yAxis = project.chart.axes.find((axis) => axis.dimension === 'y')
  const yExtentValues = hasYErrors
    ? pointsWithYErrors.flatMap((point) => [
        point.y - point.yError,
        point.y + point.yError,
      ])
    : y

  const trace: Data = {
    type: 'scatter',
    mode: 'markers',
    name: series.name,
    visible: series.visible,
    showlegend: project.chart.legend.visible,
    x,
    y,
    customdata: resolved.points.map((point) => point.rowId),
    marker: {
      color: series.style.color,
      size: series.style.marker.sizePx,
      symbol: series.style.marker.shape,
    },
    ...(hasYErrors
      ? {
          error_y: {
            type: 'data',
            symmetric: true,
            visible: true,
            array: yErrors,
            color: series.style.color,
            thickness: 1.5,
            width: 4,
          },
        }
      : {}),
  }

  return {
    data: [trace],
    layout: {
      width: clamp(
        project.chart.size.widthPx,
        CHART_SIZE_LIMITS.minWidthPx,
        CHART_SIZE_LIMITS.maxWidthPx,
      ),
      height: clamp(
        project.chart.size.heightPx,
        CHART_SIZE_LIMITS.minHeightPx,
        CHART_SIZE_LIMITS.maxHeightPx,
      ),
      title: {
        text: project.chart.title.visible ? project.chart.title.text : '',
      },
      showlegend: project.chart.legend.visible,
      xaxis: xAxis ? toPlotlyAxis(xAxis, x) : undefined,
      yaxis: yAxis ? toPlotlyAxis(yAxis, yExtentValues) : undefined,
      margin: { l: 78, r: 28, t: 64, b: 70 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: {
        family: 'Inter, ui-sans-serif, system-ui, sans-serif',
        color: '#172033',
        size: 13,
      },
    },
    config: {
      responsive: false,
      displaylogo: false,
      displayModeBar: false,
      scrollZoom: true,
    },
  }
}
