import type { Config, Data, Layout, LayoutAxis } from 'plotly.js'
import {
  isCategoryAxis,
  resolveBarSeries,
  resolveScatterSeries,
} from '../../model/dataBinding'
import { CHART_SIZE_LIMITS } from '../../model/limits'
import type {
  AxisModel,
  LegendPosition,
  LineStyle,
  MarkerShape,
  ProjectState,
  TickDirection,
} from '../../model/types'

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
  const minimum = axis.scale.minimum ?? extent[0]
  const maximum = axis.scale.maximum ?? extent[1]
  const range: [number, number] =
    axis.scale.type === 'log'
      ? [Math.log10(minimum), Math.log10(maximum)]
      : [minimum, maximum]
  return axis.scale.reversed ? [range[1], range[0]] : range
}

function toPlotlyTicks(direction: TickDirection): 'inside' | 'outside' | '' {
  if (direction === 'none') return ''
  if (direction === 'outside') return 'outside'
  return 'inside'
}

function toPlotlyDash(style: LineStyle): 'solid' | 'dash' | 'dot' | 'dashdot' {
  return style === 'dash-dot' ? 'dashdot' : style
}

function toPlotlyMarker(shape: MarkerShape): MarkerShape {
  return shape
}

function escapePlotlyText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function legendLayout(position: LegendPosition) {
  if (position === 'left') {
    return { x: -0.04, y: 0.5, xanchor: 'right' as const, yanchor: 'middle' as const, orientation: 'v' as const }
  }
  if (position === 'top') {
    return { x: 0.5, y: 1.12, xanchor: 'center' as const, yanchor: 'bottom' as const, orientation: 'h' as const }
  }
  if (position === 'bottom') {
    return { x: 0.5, y: -0.2, xanchor: 'center' as const, yanchor: 'top' as const, orientation: 'h' as const }
  }
  return { x: 1.02, y: 0.5, xanchor: 'left' as const, yanchor: 'middle' as const, orientation: 'v' as const }
}

function toPlotlyAxis(
  axis: AxisModel,
  values: number[],
  categoryAxis = false,
): Partial<LayoutAxis> {
  const range = categoryAxis ? undefined : axisRange(axis, values)
  return {
    title: { text: axis.title.visible ? escapePlotlyText(axis.title.text) : '' },
    type: categoryAxis ? 'category' : axis.scale.type,
    ...(categoryAxis
      ? { autorange: true as const }
      : {
          autorange: range
            ? (false as const)
            : axis.scale.reversed
              ? ('reversed' as const)
              : (true as const),
          range,
          dtick:
            axis.ticks.majorInterval.mode === 'fixed' &&
            axis.ticks.majorInterval.step > 0
              ? axis.ticks.majorInterval.step
              : undefined,
        }),
    showgrid: axis.gridLines.majorVisible,
    ...(!categoryAxis ? { minor: {
      showgrid: axis.gridLines.minorVisible,
      ticks: axis.ticks.minorVisible
        ? toPlotlyTicks(axis.ticks.direction)
        : '',
      dtick:
        axis.ticks.minorInterval.mode === 'fixed'
          ? axis.ticks.minorInterval.step
          : undefined,
      ticklen: axis.ticks.direction === 'cross' ? 10 : 5,
      tickcolor: axis.line.color,
      tickwidth: axis.line.widthPx,
    } } : {}),
    zeroline: false,
    ticks: axis.ticks.majorVisible
      ? toPlotlyTicks(axis.ticks.direction)
      : '',
    ticklen: axis.ticks.direction === 'cross' ? 10 : 5,
    tickcolor: axis.line.color,
    tickwidth: axis.line.widthPx,
    showline: axis.line.visible,
    linecolor: axis.line.color,
    linewidth: axis.line.widthPx,
    tickfont: {
      family: axis.labels.family,
      size: axis.labels.sizePx,
      color: axis.labels.color,
    },
    automargin: true,
  }
}

export function toPlotlyFigure(project: ProjectState): PlotlyFigure {
  const series = project.chart.series[0]
  const xAxis = project.chart.axes.find((axis) => axis.dimension === 'x')
  const yAxis = project.chart.axes.find((axis) => axis.dimension === 'y')
  let trace: Data
  let xValues: number[] = []
  let yValues: number[] = []

  if (project.chart.type === 'bar') {
    const resolved = resolveBarSeries(project, series)
    const categories = resolved.points.map((point) => point.category)
    const values = resolved.points.map((point) => point.value)
    const pointsWithErrors = resolved.points.filter(
      (point): point is typeof point & { error: number } => point.error !== null,
    )
    const hasErrors =
      resolved.showErrorBars &&
      series.errorBars.y.style.visible &&
      pointsWithErrors.length === resolved.points.length
    const errorValues = pointsWithErrors.map((point) => point.error)
    const error = hasErrors
      ? {
          type: 'data' as const,
          symmetric: true,
          visible: true,
          array: errorValues,
          color: series.errorBars.y.style.color,
          thickness: series.errorBars.y.style.widthPx,
          width: series.errorBars.y.style.capSizePx,
        }
      : undefined
    const vertical = project.chart.bar.orientation === 'vertical'
    const extent = hasErrors
      ? pointsWithErrors.flatMap((point) => [
          point.value - point.error,
          point.value + point.error,
        ])
      : values
    const valueAxis = vertical ? yAxis : xAxis
    const valueExtent = valueAxis?.scale.type === 'log' ? extent : [0, ...extent]
    if (vertical) yValues = valueExtent
    else xValues = valueExtent
    trace = {
      type: 'bar',
      orientation: vertical ? 'v' : 'h',
      name: series.name,
      visible: series.visible,
      showlegend: project.chart.legend.visible,
      x: vertical ? categories : values,
      y: vertical ? values : categories,
      customdata: resolved.points.map((point) => point.rowId),
      width: series.style.bar.widthRatio,
      opacity: series.style.bar.opacity,
      marker: {
        color: series.style.bar.fillColor,
        line: {
          color: series.style.bar.borderColor,
          width: series.style.bar.borderWidthPx,
        },
      },
      ...(hasErrors
        ? vertical
          ? { error_y: error }
          : { error_x: error }
        : {}),
    } as Data
  } else {
    const resolved = resolveScatterSeries(project, series)
    const x = resolved.points.map((point) => point.x)
    const y = resolved.points.map((point) => point.y)
    const pointsWithYErrors = resolved.points.filter(
      (point): point is typeof point & { yError: number } =>
        point.yError !== null,
    )
    const hasYErrors =
      resolved.showYErrorBars &&
      series.errorBars.y.style.visible &&
      pointsWithYErrors.length === resolved.points.length
    const yErrors = pointsWithYErrors.map((point) => point.yError)
    const yExtentValues = hasYErrors
      ? pointsWithYErrors.flatMap((point) => [
          point.y - point.yError,
          point.y + point.yError,
        ])
      : y
    xValues = x
    yValues = yExtentValues
    const mode = [
      series.style.line.visible ? 'lines' : '',
      series.style.marker.visible ? 'markers' : '',
    ]
      .filter(Boolean)
      .join('+') || 'none'
    trace = {
      type: 'scatter',
      mode: mode as 'markers' | 'lines' | 'lines+markers' | 'none',
      name: series.name,
      visible: series.visible,
      showlegend: project.chart.legend.visible,
      x,
      y,
      customdata: resolved.points.map((point) => point.rowId),
      marker: {
        color: series.style.marker.fillColor,
        size: series.style.marker.sizePx,
        symbol: toPlotlyMarker(series.style.marker.shape),
        line: {
          color: series.style.marker.borderColor,
          width: series.style.marker.borderWidthPx,
        },
      },
      line: {
        color: series.style.line.color,
        width: series.style.line.widthPx,
        dash: toPlotlyDash(series.style.line.dash),
      },
      ...(hasYErrors
        ? {
            error_y: {
              type: 'data',
              symmetric: true,
              visible: true,
              array: yErrors,
              color: series.errorBars.y.style.color,
              thickness: series.errorBars.y.style.widthPx,
              width: series.errorBars.y.style.capSizePx,
            },
          }
        : {}),
    }
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
        text: project.chart.title.visible
          ? project.chart.title.style.bold
            ? `<b>${escapePlotlyText(project.chart.title.text)}</b>`
            : escapePlotlyText(project.chart.title.text)
          : '',
        font: {
          family: project.chart.title.style.family,
          size: project.chart.title.style.sizePx,
          color: project.chart.title.style.color,
        },
      },
      showlegend: project.chart.legend.visible,
      legend: legendLayout(project.chart.legend.position),
      xaxis: xAxis
        ? toPlotlyAxis(xAxis, xValues, isCategoryAxis(project, 'x'))
        : undefined,
      yaxis: yAxis
        ? toPlotlyAxis(yAxis, yValues, isCategoryAxis(project, 'y'))
        : undefined,
      bargap: project.chart.type === 'bar' ? project.chart.bar.gapRatio : undefined,
      margin: { l: 78, r: 28, t: 64, b: 70 },
      paper_bgcolor: project.chart.style.backgroundColor,
      plot_bgcolor: project.chart.style.plotBackgroundColor,
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
