import type { ProjectState } from '../model/types'

export type ChartSelection =
  | { type: 'chart'; chartId: string }
  | { type: 'axis'; axisId: string }
  | { type: 'series'; seriesId: string }
  | { type: 'error-bars'; seriesId: string; direction: 'value' }
  | { type: 'legend'; chartId: string }
  | { type: 'chart-title'; chartId: string }

export function defaultSelection(project: ProjectState): ChartSelection {
  return { type: 'chart', chartId: project.chart.id }
}

export function selectionKey(selection: ChartSelection): string {
  if (selection.type === 'chart') return `chart:${selection.chartId}`
  if (selection.type === 'axis') return `axis:${selection.axisId}`
  if (selection.type === 'series') return `series:${selection.seriesId}`
  if (selection.type === 'error-bars') {
    return `error-bars:${selection.seriesId}:${selection.direction}`
  }
  if (selection.type === 'legend') return `legend:${selection.chartId}`
  return `chart-title:${selection.chartId}`
}

export function selectionFromKey(
  project: ProjectState,
  key: string,
): ChartSelection {
  if (key === `chart:${project.chart.id}`) return defaultSelection(project)
  const axis = project.chart.axes.find((item) => key === `axis:${item.id}`)
  if (axis) return { type: 'axis', axisId: axis.id }
  const series = project.chart.series.find(
    (item) =>
      key === `series:${item.id}` || key === `error-bars:${item.id}:value`,
  )
  if (series) {
    return key.startsWith('error-bars:')
      ? { type: 'error-bars', seriesId: series.id, direction: 'value' }
      : { type: 'series', seriesId: series.id }
  }
  if (key === `legend:${project.chart.id}`) {
    return { type: 'legend', chartId: project.chart.id }
  }
  if (key === `chart-title:${project.chart.id}`) {
    return { type: 'chart-title', chartId: project.chart.id }
  }
  return defaultSelection(project)
}
