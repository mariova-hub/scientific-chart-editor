import {
  isCategoryAxis,
  resolveBarSeries,
  resolveScatterSeries,
} from './dataBinding'
import { STYLE_LIMITS } from './limits'
import type { ProjectState, ValidationIssue } from './types'

function isInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function styleIssue(
  code: string,
  path: string,
  message: string,
): ValidationIssue {
  return { code, path, message }
}

export function validateAxisSettings(
  project: ProjectState,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const axis of project.chart.axes) {
    const label = `${axis.dimension.toUpperCase()}軸`
    const path = `project.chart.axes.${axis.id}`
    const { minimum, maximum } = axis.scale

    if (minimum !== null && !Number.isFinite(minimum)) {
      issues.push({
        code: 'axis.minimum',
        path: `${path}.scale.minimum`,
        message: `${label}の最小値は有限数にしてください。`,
      })
    }
    if (maximum !== null && !Number.isFinite(maximum)) {
      issues.push({
        code: 'axis.maximum',
        path: `${path}.scale.maximum`,
        message: `${label}の最大値は有限数にしてください。`,
      })
    }
    if (minimum !== null && maximum !== null && minimum >= maximum) {
      issues.push({
        code: 'axis.range',
        path: `${path}.scale`,
        message: `${label}の最小値は最大値より小さくしてください。`,
      })
    }

    if (
      axis.ticks.majorInterval.mode === 'fixed' &&
      (!Number.isFinite(axis.ticks.majorInterval.step) ||
        axis.ticks.majorInterval.step <= 0)
    ) {
      issues.push({
        code: 'axis.majorUnit',
        path: `${path}.ticks.majorInterval`,
        message: `${label}の主単位は0より大きい有限数にしてください。`,
      })
    }
    if (
      axis.ticks.minorInterval.mode === 'fixed' &&
      (!Number.isFinite(axis.ticks.minorInterval.step) ||
        axis.ticks.minorInterval.step <= 0)
    ) {
      issues.push({
        code: 'axis.minorUnit',
        path: `${path}.ticks.minorInterval`,
        message: `${label}の補助単位は0より大きい有限数にしてください。`,
      })
    }

    if (axis.scale.type === 'log') {
      if (minimum !== null && minimum <= 0) {
        issues.push({
          code: 'axis.log.minimum',
          path: `${path}.scale.minimum`,
          message: `${label}の対数表示では最小値を0より大きくしてください。`,
        })
      }
      if (maximum !== null && maximum <= 0) {
        issues.push({
          code: 'axis.log.maximum',
          path: `${path}.scale.maximum`,
          message: `${label}の対数表示では最大値を0より大きくしてください。`,
        })
      }
    }

    const tickValues = [
      ['majorLengthPx', axis.ticks.majorLengthPx, '主目盛の長さ'],
      ['minorLengthPx', axis.ticks.minorLengthPx, '補助目盛の長さ'],
    ] as const
    for (const [field, value, fieldLabel] of tickValues) {
      if (!isInRange(value, STYLE_LIMITS.minTickLengthPx, STYLE_LIMITS.maxTickLengthPx)) {
        issues.push(styleIssue(
          'axis.tickLength',
          `${path}.ticks.${field}`,
          `${label}の${fieldLabel}は${STYLE_LIMITS.minTickLengthPx}〜${STYLE_LIMITS.maxTickLengthPx}にしてください。`,
        ))
      }
    }
    if (!isInRange(axis.ticks.lineWidthPx, STYLE_LIMITS.minTickLineWidthPx, STYLE_LIMITS.maxTickLineWidthPx)) {
      issues.push(styleIssue(
        'axis.tickWidth',
        `${path}.ticks.lineWidthPx`,
        `${label}の目盛線の太さは${STYLE_LIMITS.minTickLineWidthPx}〜${STYLE_LIMITS.maxTickLineWidthPx}にしてください。`,
      ))
    }
    if (!isInRange(axis.labels.sizePx, STYLE_LIMITS.minFontSizePx, STYLE_LIMITS.maxFontSizePx)) {
      issues.push(styleIssue('axis.labelFontSize', `${path}.labels.sizePx`, `${label}のラベル文字サイズが許容範囲外です。`))
    }
    if (!isInRange(axis.title.style.sizePx, STYLE_LIMITS.minFontSizePx, STYLE_LIMITS.maxFontSizePx)) {
      issues.push(styleIssue('axis.titleFontSize', `${path}.title.style.sizePx`, `${label}のタイトル文字サイズが許容範囲外です。`))
    }
    if (!isInRange(axis.labels.angleDeg, STYLE_LIMITS.minLabelAngleDeg, STYLE_LIMITS.maxLabelAngleDeg)) {
      issues.push(styleIssue(
        'axis.labelAngle',
        `${path}.labels.angleDeg`,
        `${label}のラベル角度は${STYLE_LIMITS.minLabelAngleDeg}〜${STYLE_LIMITS.maxLabelAngleDeg}度にしてください。`,
      ))
    }
    if (
      axis.numberFormat.kind !== 'auto' &&
      axis.numberFormat.kind !== 'integer' &&
      (!Number.isInteger(axis.numberFormat.decimalPlaces) ||
        !isInRange(axis.numberFormat.decimalPlaces, STYLE_LIMITS.minDecimalPlaces, STYLE_LIMITS.maxDecimalPlaces))
    ) {
      issues.push(styleIssue(
        'axis.decimalPlaces',
        `${path}.numberFormat.decimalPlaces`,
        `${label}の小数点以下桁数は${STYLE_LIMITS.minDecimalPlaces}〜${STYLE_LIMITS.maxDecimalPlaces}の整数にしてください。`,
      ))
    }
    for (const [kind, grid] of [
      ['majorStyle', axis.gridLines.majorStyle],
      ['minorStyle', axis.gridLines.minorStyle],
    ] as const) {
      if (!isInRange(grid.widthPx, 0, STYLE_LIMITS.maxLineWidthPx)) {
        issues.push(styleIssue('axis.gridWidth', `${path}.gridLines.${kind}.widthPx`, `${label}のグリッド線の太さが許容範囲外です。`))
      }
      if (!isHexColor(grid.color)) {
        issues.push(styleIssue('axis.gridColor', `${path}.gridLines.${kind}.color`, `${label}のグリッド線の色は#RRGGBB形式にしてください。`))
      }
      if (!['solid', 'dash', 'dot'].includes(grid.style)) {
        issues.push(styleIssue('axis.gridStyle', `${path}.gridLines.${kind}.style`, `${label}のグリッド線種が不正です。`))
      }
    }
    for (const [fieldPath, color, fieldLabel] of [
      ['line.color', axis.line.color, '軸線'],
      ['labels.color', axis.labels.color, '目盛ラベル'],
      ['title.style.color', axis.title.style.color, '軸タイトル'],
    ] as const) {
      if (!isHexColor(color)) {
        issues.push(styleIssue('axis.color', `${path}.${fieldPath}`, `${label}の${fieldLabel}の色は#RRGGBB形式にしてください。`))
      }
    }
    if (!isInRange(axis.line.widthPx, STYLE_LIMITS.minLineWidthPx, STYLE_LIMITS.maxLineWidthPx)) {
      issues.push(styleIssue('axis.lineWidth', `${path}.line.widthPx`, `${label}の軸線の太さが許容範囲外です。`))
    }
  }

  return issues
}

export function validatePlotAreaSettings(
  project: ProjectState,
): ValidationIssue[] {
  const { border, margin } = project.chart.plotArea
  const path = 'project.chart.plotArea'
  const issues: ValidationIssue[] = []
  if (!isInRange(border.widthPx, 0, STYLE_LIMITS.maxLineWidthPx)) {
    issues.push(styleIssue('plotArea.borderWidth', `${path}.border.widthPx`, 'プロット領域の枠線の太さが許容範囲外です。'))
  }
  if (!isHexColor(border.color)) {
    issues.push(styleIssue('plotArea.borderColor', `${path}.border.color`, 'プロット領域の枠線色は#RRGGBB形式にしてください。'))
  }
  for (const field of ['topPx', 'rightPx', 'bottomPx', 'leftPx'] as const) {
    if (!isInRange(margin[field], STYLE_LIMITS.minMarginPx, STYLE_LIMITS.maxMarginPx)) {
      issues.push(styleIssue('plotArea.margin', `${path}.margin.${field}`, `余白は${STYLE_LIMITS.minMarginPx}〜${STYLE_LIMITS.maxMarginPx}pxにしてください。`))
    }
  }
  if (
    margin.mode === 'manual' &&
    margin.leftPx + margin.rightPx > project.chart.size.widthPx - STYLE_LIMITS.minPlotWidthPx
  ) {
    issues.push(styleIssue('plotArea.margin.horizontal', `${path}.margin`, `左右の余白を減らし、プロット幅を${STYLE_LIMITS.minPlotWidthPx}px以上確保してください。`))
  }
  if (
    margin.mode === 'manual' &&
    margin.topPx + margin.bottomPx > project.chart.size.heightPx - STYLE_LIMITS.minPlotHeightPx
  ) {
    issues.push(styleIssue('plotArea.margin.vertical', `${path}.margin`, `上下の余白を減らし、プロット高さを${STYLE_LIMITS.minPlotHeightPx}px以上確保してください。`))
  }
  return issues
}

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
