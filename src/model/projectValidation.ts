import { CHART_SIZE_LIMITS, DATA_LIMITS } from './limits'
import { STYLE_LIMITS } from './limits'
import { resolveDataRange } from './dataBinding'
import { validateLogAxes } from './axisValidation'
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

function validateBarRowBindings(
  project: ProjectState,
  requireCompleteBinding: boolean,
): ValidationIssue[] {
  const binding = project.chart.series[0].barRowBindings
  const path = 'project.chart.series[0].barRowBindings'
  const issues: ValidationIssue[] = []
  const hasStoredReference = Object.values(binding).some((value) => value !== null)
  if (!requireCompleteBinding && !hasStoredReference) return []
  if (!binding.datasetId) {
    return [issue('binding.required', `${path}.datasetId`, '参照する表を選択してください。')]
  }
  const dataset = project.datasets.find((item) => item.id === binding.datasetId)
  if (!dataset) {
    return [issue('reference.dataset', `${path}.datasetId`, '参照先の表が存在しません。')]
  }

  const columnIndex = (columnId: string | null) =>
    columnId === null
      ? -1
      : dataset.columns.findIndex((column) => column.id === columnId)
  if (requireCompleteBinding && !binding.categoryStartColumnId) {
    issues.push(issue('binding.required', `${path}.categoryStartColumnId`, 'カテゴリの開始列を選択してください。'))
  } else if (
    binding.categoryStartColumnId !== null &&
    columnIndex(binding.categoryStartColumnId) < 0
  ) {
    issues.push(issue('reference.column', `${path}.categoryStartColumnId`, 'カテゴリの開始列が存在しません。'))
  }
  if (requireCompleteBinding && !binding.categoryEndColumnId) {
    issues.push(issue('binding.required', `${path}.categoryEndColumnId`, 'カテゴリの終了列を選択してください。'))
  } else if (
    binding.categoryEndColumnId !== null &&
    columnIndex(binding.categoryEndColumnId) < 0
  ) {
    issues.push(issue('reference.column', `${path}.categoryEndColumnId`, 'カテゴリの終了列が存在しません。'))
  }
  const startIndex = columnIndex(binding.categoryStartColumnId)
  const endIndex = columnIndex(binding.categoryEndColumnId)
  if (startIndex >= 0 && endIndex >= 0 && startIndex > endIndex) {
    issues.push(issue('binding.categoryRange', `${path}.categoryStartColumnId`, 'カテゴリの開始列は終了列以前にしてください。'))
  }

  if (requireCompleteBinding && !binding.valueRowId) {
    issues.push(issue('binding.required', `${path}.valueRowId`, '値の行を選択してください。'))
  } else if (
    binding.valueRowId !== null &&
    !dataset.rows.some((row) => row.id === binding.valueRowId)
  ) {
    issues.push(issue('reference.row', `${path}.valueRowId`, '値の行が存在しません。'))
  }
  if (
    binding.errorRowId !== null &&
    !dataset.rows.some((row) => row.id === binding.errorRowId)
  ) {
    issues.push(issue('reference.row', `${path}.errorRowId`, '誤差の行が存在しません。'))
  }
  if (
    binding.labelColumnId !== null &&
    !dataset.columns.some((column) => column.id === binding.labelColumnId)
  ) {
    issues.push(issue('reference.column', `${path}.labelColumnId`, '行ラベルの列が存在しません。'))
  }
  return issues
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
  if (
    axis.ticks.minorInterval.mode === 'fixed' &&
    (!Number.isFinite(axis.ticks.minorInterval.step) ||
      axis.ticks.minorInterval.step <= 0)
  ) {
    issues.push(issue('axis.minorUnit', `${path}.ticks.minorInterval`, '補助目盛は0より大きい値にしてください。'))
  }
  if (!isHexColor(axis.line.color)) {
    issues.push(issue('style.color', `${path}.line.color`, '軸線の色は#RRGGBB形式にしてください。'))
  }
  if (!isHexColor(axis.labels.color)) {
    issues.push(issue('style.color', `${path}.labels.color`, '軸ラベルの色は#RRGGBB形式にしてください。'))
  }
  if (!inRange(axis.line.widthPx, STYLE_LIMITS.minLineWidthPx, STYLE_LIMITS.maxLineWidthPx)) {
    issues.push(issue('style.width', `${path}.line.widthPx`, '軸線の太さが許容範囲外です。'))
  }
  if (!inRange(axis.labels.sizePx, STYLE_LIMITS.minFontSizePx, STYLE_LIMITS.maxFontSizePx)) {
    issues.push(issue('style.fontSize', `${path}.labels.sizePx`, '軸ラベルの文字サイズが許容範囲外です。'))
  }
  return issues
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function inRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
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

  if (project.chart.type !== 'scatter' && project.chart.type !== 'bar') {
    issues.push(issue('chart.type', 'project.chart.type', '対応していないグラフの種類です。'))
  }
  if (project.chart.type === 'scatter' && project.chart.dataOrientation === 'rows') {
    issues.push(issue(
      'dataOrientation.unsupported',
      'project.chart.dataOrientation',
      '行方向のデータ解釈は現在、棒グラフで利用できます。',
    ))
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
  issues.push(...validateLogAxes(project))

  const series = project.chart.series[0]
  const rowOrientedBar =
    project.chart.type === 'bar' && project.chart.dataOrientation === 'rows'
  const primaryBinding = rowOrientedBar
    ? null
    : project.chart.type === 'bar'
      ? series.barBindings.category
      : series.bindings.x
  const secondaryBinding = rowOrientedBar
    ? null
    : project.chart.type === 'bar'
      ? series.barBindings.value
      : series.bindings.y
  if (rowOrientedBar) {
    issues.push(...validateBarRowBindings(project, true))
  } else {
    issues.push(...validateBarRowBindings(project, false))
    const primaryPath =
      project.chart.type === 'bar'
        ? 'project.chart.series[0].barBindings.category'
        : 'project.chart.series[0].bindings.x'
    const secondaryPath =
      project.chart.type === 'bar'
        ? 'project.chart.series[0].barBindings.value'
        : 'project.chart.series[0].bindings.y'
    issues.push(...validateBinding(project, primaryBinding, primaryPath))
    issues.push(...validateBinding(project, secondaryBinding, secondaryPath))

    if (primaryBinding && secondaryBinding) {
      const primaryLength = resolveDataRange(project.datasets, primaryBinding).length
      const secondaryLength = resolveDataRange(project.datasets, secondaryBinding).length
      if (primaryLength !== secondaryLength) {
        issues.push(issue(
          'binding.length',
          project.chart.type === 'bar'
            ? 'project.chart.series[0].barBindings'
            : 'project.chart.series[0].bindings',
          project.chart.type === 'bar'
            ? 'カテゴリ列と値の列の範囲長が一致しません。'
            : 'X列とY列の範囲長が一致しません。',
        ))
      }
    }

    const errorBinding =
      project.chart.type === 'bar'
        ? series.barBindings.error
        : series.errorBars.y.enabled
          ? series.errorBars.y.value?.source ?? null
          : null
    if (errorBinding) {
      const errorPath = project.chart.type === 'bar'
        ? 'project.chart.series[0].barBindings.error'
        : 'project.chart.series[0].errorBars.y.value.source'
      issues.push(...validateBinding(project, errorBinding, errorPath))
      if (primaryBinding) {
        const primaryLength = resolveDataRange(project.datasets, primaryBinding).length
        const errorLength = resolveDataRange(project.datasets, errorBinding).length
        if (primaryLength !== errorLength) {
          issues.push(issue(
            'errorBar.length',
            errorPath,
            project.chart.type === 'bar'
              ? '誤差の列の範囲長がカテゴリ列・値の列と一致しません。'
              : 'Y Error列の範囲長がX/Y列と一致しません。',
          ))
        }
      }
    } else if (project.chart.type === 'scatter' && series.errorBars.y.enabled) {
      issues.push(issue('errorBar.required', 'project.chart.series[0].errorBars.y.value', 'Y Error列を選択してください。'))
    }
  }

  const axisIds = new Set(project.chart.axes.map((axis) => axis.id))
  if (!axisIds.has(series.axisIds.x) || !axisIds.has(series.axisIds.y)) {
    issues.push(issue('reference.axis', 'project.chart.series[0].axisIds', '系列の参照軸が存在しません。'))
  }

  const styleChecks: Array<[boolean, string, string]> = [
    [isHexColor(project.chart.style.backgroundColor), 'project.chart.style.backgroundColor', 'グラフ背景色'],
    [isHexColor(project.chart.style.plotBackgroundColor), 'project.chart.style.plotBackgroundColor', 'プロット背景色'],
    [isHexColor(project.chart.title.style.color), 'project.chart.title.style.color', 'タイトル色'],
    [isHexColor(series.style.color), 'project.chart.series[0].style.color', '系列基準色'],
    [isHexColor(series.style.marker.fillColor), 'project.chart.series[0].style.marker.fillColor', 'マーカー塗り色'],
    [isHexColor(series.style.marker.borderColor), 'project.chart.series[0].style.marker.borderColor', 'マーカー枠線色'],
    [isHexColor(series.style.line.color), 'project.chart.series[0].style.line.color', '系列線色'],
    [isHexColor(series.style.bar.fillColor), 'project.chart.series[0].style.bar.fillColor', '棒塗り色'],
    [isHexColor(series.style.bar.borderColor), 'project.chart.series[0].style.bar.borderColor', '棒枠線色'],
    [isHexColor(series.errorBars.x.style.color), 'project.chart.series[0].errorBars.x.style.color', 'X誤差範囲色'],
    [isHexColor(series.errorBars.y.style.color), 'project.chart.series[0].errorBars.y.style.color', 'Y誤差範囲色'],
  ]
  for (const [valid, path, label] of styleChecks) {
    if (!valid) issues.push(issue('style.color', path, `${label}は#RRGGBB形式にしてください。`))
  }
  const numberStyleChecks: Array<[number, number, number, string]> = [
    [project.chart.title.style.sizePx, STYLE_LIMITS.minFontSizePx, STYLE_LIMITS.maxFontSizePx, 'project.chart.title.style.sizePx'],
    [series.style.marker.sizePx, STYLE_LIMITS.minMarkerSizePx, STYLE_LIMITS.maxMarkerSizePx, 'project.chart.series[0].style.marker.sizePx'],
    [series.style.marker.borderWidthPx, STYLE_LIMITS.minBorderWidthPx, STYLE_LIMITS.maxBorderWidthPx, 'project.chart.series[0].style.marker.borderWidthPx'],
    [series.style.line.widthPx, STYLE_LIMITS.minLineWidthPx, STYLE_LIMITS.maxLineWidthPx, 'project.chart.series[0].style.line.widthPx'],
    [series.style.bar.borderWidthPx, STYLE_LIMITS.minBorderWidthPx, STYLE_LIMITS.maxBorderWidthPx, 'project.chart.series[0].style.bar.borderWidthPx'],
    [series.style.bar.opacity, 0, 1, 'project.chart.series[0].style.bar.opacity'],
    [series.style.bar.widthRatio, 0.05, 1, 'project.chart.series[0].style.bar.widthRatio'],
    [project.chart.bar.gapRatio, 0, 0.9, 'project.chart.bar.gapRatio'],
    [series.errorBars.x.style.widthPx, STYLE_LIMITS.minLineWidthPx, STYLE_LIMITS.maxLineWidthPx, 'project.chart.series[0].errorBars.x.style.widthPx'],
    [series.errorBars.x.style.capSizePx, STYLE_LIMITS.minCapSizePx, STYLE_LIMITS.maxCapSizePx, 'project.chart.series[0].errorBars.x.style.capSizePx'],
    [series.errorBars.y.style.widthPx, STYLE_LIMITS.minLineWidthPx, STYLE_LIMITS.maxLineWidthPx, 'project.chart.series[0].errorBars.y.style.widthPx'],
    [series.errorBars.y.style.capSizePx, STYLE_LIMITS.minCapSizePx, STYLE_LIMITS.maxCapSizePx, 'project.chart.series[0].errorBars.y.style.capSizePx'],
  ]
  for (const [value, minimum, maximum, path] of numberStyleChecks) {
    if (!inRange(value, minimum, maximum)) {
      issues.push(issue('style.range', path, '書式の数値が許容範囲外です。'))
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

export function getProjectWarnings(project: ProjectState): ValidationIssue[] {
  if (project.chart.type !== 'bar') return []
  const valueDimension =
    project.chart.bar.orientation === 'vertical' ? 'y' : 'x'
  const valueAxis = project.chart.axes.find(
    (axis) => axis.dimension === valueDimension,
  )
  if (!valueAxis || valueAxis.scale.minimum === null || valueAxis.scale.minimum === 0) {
    return []
  }
  return [issue(
    'bar.baseline.nonzero',
    `project.chart.axes.${valueAxis.id}.scale.minimum`,
    '棒グラフの値軸が0から始まっていません。比較の見え方が強調される可能性があります。',
  )]
}
