import { CHART_SIZE_LIMITS, DATA_LIMITS } from './limits'
import { resolveDataRange } from './dataBinding'
import type {
  AxisModel,
  DataRangeRef,
  ProjectState,
  ValidationIssue,
} from './types'

function issue(
  code: string,
  path: string,
  message: string,
): ValidationIssue {
  return { code, path, message }
}

function validateBinding(
  project: ProjectState,
  binding: DataRangeRef | null,
  path: string,
): ValidationIssue[] {
  if (!binding) return [issue('binding.required', path, '列を選択してください。')]
  const dataset = project.datasets.find((item) => item.id === binding.datasetId)
  if (!dataset) {
    return [issue('reference.dataset', path, '参照先の表が存在しません。')]
  }
  if (!dataset.columns.some((column) => column.id === binding.columnId)) {
    return [issue('reference.column', path, '参照先の列が存在しません。')]
  }
  if (binding.rows.kind === 'range') {
    const range = binding.rows
    const start = dataset.rows.findIndex((row) => row.id === range.startRowId)
    const end = dataset.rows.findIndex((row) => row.id === range.endRowId)
    if (start < 0 || end < start) {
      return [issue('reference.rows', path, '参照する行範囲が不正です。')]
    }
  }
  return []
}

function validateAxis(axis: AxisModel, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { minimum, maximum } = axis.scale
  if (minimum !== null && !Number.isFinite(minimum)) {
    issues.push(issue('axis.minimum', `${path}.scale.minimum`, '最小値は有限数にしてください。'))
  }
  if (maximum !== null && !Number.isFinite(maximum)) {
    issues.push(issue('axis.maximum', `${path}.scale.maximum`, '最大値は有限数にしてください。'))
  }
  if (minimum !== null && maximum !== null && minimum >= maximum) {
    issues.push(issue('axis.range', `${path}.scale`, '最小値は最大値より小さくしてください。'))
  }
  if (
    axis.ticks.majorInterval.mode === 'fixed' &&
    (!Number.isFinite(axis.ticks.majorInterval.step) ||
      axis.ticks.majorInterval.step <= 0)
  ) {
    issues.push(issue('axis.majorUnit', `${path}.ticks.majorInterval`, '主目盛は0より大きい値にしてください。'))
  }
  return issues
}

export function validateProjectSemantics(
  project: ProjectState,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (project.datasets.length !== 1) {
    issues.push(issue('dataset.count', 'project.datasets', '表データが1つ必要です。'))
    return issues
  }

  const dataset = project.datasets[0]
  if (dataset.columns.length === 0 || dataset.columns.length > DATA_LIMITS.maxColumns) {
    issues.push(issue('dataset.columns', 'project.datasets[0].columns', '列数が許容範囲外です。'))
  }
  if (dataset.rows.length > DATA_LIMITS.maxRows) {
    issues.push(issue('dataset.rows', 'project.datasets[0].rows', '行数が許容範囲外です。'))
  }

  if (project.chart.type !== 'scatter') {
    issues.push(issue('chart.type', 'project.chart.type', 'Phase 1では散布図だけを読み込めます。'))
  }
  if (project.chart.axes.length !== 2) {
    issues.push(issue('axis.count', 'project.chart.axes', 'X軸とY軸が1つずつ必要です。'))
  }
  if (project.chart.series.length !== 1) {
    issues.push(issue('series.count', 'project.chart.series', 'Phase 1では系列が1つ必要です。'))
    return issues
  }

  project.chart.axes.forEach((axis, index) => {
    issues.push(...validateAxis(axis, `project.chart.axes[${index}]`))
  })

  const series = project.chart.series[0]
  issues.push(...validateBinding(project, series.bindings.x, 'project.chart.series[0].bindings.x'))
  issues.push(...validateBinding(project, series.bindings.y, 'project.chart.series[0].bindings.y'))

  const axisIds = new Set(project.chart.axes.map((axis) => axis.id))
  if (!axisIds.has(series.axisIds.x) || !axisIds.has(series.axisIds.y)) {
    issues.push(issue('reference.axis', 'project.chart.series[0].axisIds', '系列の参照軸が存在しません。'))
  }

  if (series.bindings.x && series.bindings.y) {
    const xLength = resolveDataRange(project.datasets, series.bindings.x).length
    const yLength = resolveDataRange(project.datasets, series.bindings.y).length
    if (xLength !== yLength) {
      issues.push(issue('binding.length', 'project.chart.series[0].bindings', 'X列とY列の範囲長が一致しません。'))
    }
  }

  if (series.errorBars.y.enabled) {
    if (!series.errorBars.y.value) {
      issues.push(issue('errorBar.required', 'project.chart.series[0].errorBars.y.value', 'Y Error列を選択してください。'))
    } else {
      issues.push(...validateBinding(project, series.errorBars.y.value.source, 'project.chart.series[0].errorBars.y.value.source'))
      if (series.bindings.x) {
        const xLength = resolveDataRange(project.datasets, series.bindings.x).length
        const errorLength = resolveDataRange(
          project.datasets,
          series.errorBars.y.value.source,
        ).length
        if (xLength !== errorLength) {
          issues.push(issue('errorBar.length', 'project.chart.series[0].errorBars.y', 'Y Error列の範囲長がX/Y列と一致しません。'))
        }
      }
    }
  }

  const { widthPx, heightPx } = project.chart.size
  if (
    !Number.isInteger(widthPx) ||
    widthPx < CHART_SIZE_LIMITS.minWidthPx ||
    widthPx > CHART_SIZE_LIMITS.maxWidthPx
  ) {
    issues.push(issue('chart.width', 'project.chart.size.widthPx', `幅は${CHART_SIZE_LIMITS.minWidthPx}〜${CHART_SIZE_LIMITS.maxWidthPx}pxにしてください。`))
  }
  if (
    !Number.isInteger(heightPx) ||
    heightPx < CHART_SIZE_LIMITS.minHeightPx ||
    heightPx > CHART_SIZE_LIMITS.maxHeightPx
  ) {
    issues.push(issue('chart.height', 'project.chart.size.heightPx', `高さは${CHART_SIZE_LIMITS.minHeightPx}〜${CHART_SIZE_LIMITS.maxHeightPx}pxにしてください。`))
  }

  const ids = [
    project.id,
    dataset.id,
    project.chart.id,
    ...dataset.columns.map((column) => column.id),
    ...dataset.rows.map((row) => row.id),
    ...project.chart.axes.map((axis) => axis.id),
    series.id,
  ]
  if (new Set(ids).size !== ids.length) {
    issues.push(issue('id.duplicate', 'project', 'stable IDが重複しています。'))
  }

  const columnIds = new Set(dataset.columns.map((column) => column.id))
  dataset.rows.forEach((row, rowIndex) => {
    for (const columnId of Object.keys(row.cells)) {
      if (!columnIds.has(columnId)) {
        issues.push(issue('reference.cellColumn', `project.datasets[0].rows[${rowIndex}].cells`, 'セルが未知の列を参照しています。'))
      }
    }
  })

  return issues
}
