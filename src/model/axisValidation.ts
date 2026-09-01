import {
  isCategoryAxis,
  resolveBarSeries,
  resolveScatterSeries,
} from './dataBinding'
import type { ProjectState, ValidationIssue } from './types'

export function validateLogAxes(project: ProjectState): ValidationIssue[] {
  const series = project.chart.series[0]
  if (!series) return []
  const scatter =
    project.chart.type === 'scatter'
      ? resolveScatterSeries(project, series)
      : null
  const bar =
    project.chart.type === 'bar' ? resolveBarSeries(project, series) : null
  const issues: ValidationIssue[] = []

  for (const axis of project.chart.axes) {
    if (isCategoryAxis(project, axis.dimension) || axis.scale.type !== 'log') {
      continue
    }
    const path = `project.chart.axes.${axis.id}.scale`
    if (axis.scale.minimum !== null && axis.scale.minimum <= 0) {
      issues.push({
        code: 'axis.log.minimum',
        path: `${path}.minimum`,
        message: `${axis.dimension.toUpperCase()}軸の対数表示では最小値を0より大きくしてください。`,
      })
    }
    if (axis.scale.maximum !== null && axis.scale.maximum <= 0) {
      issues.push({
        code: 'axis.log.maximum',
        path: `${path}.maximum`,
        message: `${axis.dimension.toUpperCase()}軸の対数表示では最大値を0より大きくしてください。`,
      })
    }

    const invalidPointCount = scatter
      ? scatter.points.filter((point) => {
          if (axis.dimension === 'x') return point.x <= 0
          if (point.y <= 0) return true
          return (
            scatter.showYErrorBars &&
            series.errorBars.y.style.visible &&
            point.yError !== null &&
            point.y - point.yError <= 0
          )
        }).length
      : (bar?.points.filter((point) => {
          if (point.value <= 0) return true
          return (
            bar.showErrorBars &&
            series.errorBars.y.style.visible &&
            point.error !== null &&
            point.value - point.error <= 0
          )
        }).length ?? 0)
    if (invalidPointCount > 0) {
      issues.push({
        code: 'axis.log.data',
        path,
        message: `${axis.dimension.toUpperCase()}軸を対数表示にできません。0以下になる描画値が${invalidPointCount}件あります。`,
      })
    }
  }
  return issues
}
