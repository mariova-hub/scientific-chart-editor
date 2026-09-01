import { DATA_LIMITS } from '../model/limits'
import { validateProjectSemantics } from '../model/projectValidation'
import {
  defaultAxisLabels,
  defaultAxisLine,
  defaultBarOptions,
  defaultBarRowBindings,
  defaultBarStyle,
  defaultChartStyle,
  defaultErrorBarStyle,
  defaultLineStyle,
  defaultMarkerStyle,
  defaultTitleStyle,
} from '../model/defaults'
import type {
  AxisModel,
  CellValue,
  DataRangeRef,
  DatasetModel,
  ErrorBarModel,
  ProjectFileV01,
  ProjectState,
  SeriesModel,
  ValidationIssue,
} from '../model/types'

export type ProjectParseResult =
  | { ok: true; project: ProjectState }
  | { ok: false; error: ValidationIssue }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isCellValue(value: unknown): value is CellValue {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function hasValidExtensions(value: Record<string, unknown>): boolean {
  return value.extensions === undefined || isRecord(value.extensions)
}

function valueOrDefault<T>(value: unknown, fallback: T): unknown {
  return value === undefined ? fallback : value
}

function hydrateProjectV01(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.chart)) return value
  const chart = value.chart
  const axes = Array.isArray(chart.axes)
    ? chart.axes.map((axis) => {
        if (!isRecord(axis)) return axis
        const ticks = isRecord(axis.ticks) ? axis.ticks : axis.ticks
        return {
          ...axis,
          ticks: isRecord(ticks)
            ? {
                ...ticks,
                majorVisible: valueOrDefault(ticks.majorVisible, true),
                minorVisible: valueOrDefault(ticks.minorVisible, false),
              }
            : ticks,
          line: valueOrDefault(axis.line, defaultAxisLine()),
          labels: valueOrDefault(axis.labels, defaultAxisLabels()),
        }
      })
    : chart.axes
  const series = Array.isArray(chart.series)
    ? chart.series.map((item) => {
        if (!isRecord(item) || !isRecord(item.style)) return item
        const style = item.style
        const baseColor =
          typeof style.color === 'string' ? style.color : '#2563eb'
        const line = isRecord(style.line)
          ? {
              ...defaultLineStyle(),
              ...style.line,
              color: valueOrDefault(style.line.color, baseColor),
            }
          : style.line
        const marker = isRecord(style.marker)
          ? {
              ...defaultMarkerStyle(),
              ...style.marker,
              fillColor: valueOrDefault(style.marker.fillColor, baseColor),
              borderColor: valueOrDefault(
                style.marker.borderColor,
                baseColor,
              ),
              borderWidthPx: valueOrDefault(
                style.marker.borderWidthPx,
                1,
              ),
            }
          : style.marker
        const bar = isRecord(style.bar)
          ? {
              ...defaultBarStyle(),
              ...style.bar,
              opacity: valueOrDefault(style.bar.opacity, 1),
              widthRatio: valueOrDefault(style.bar.widthRatio, 0.8),
            }
          : style.bar
        const errorBars = isRecord(item.errorBars)
          ? Object.fromEntries(
              Object.entries(item.errorBars).map(([key, errorBar]) => [
                key,
                isRecord(errorBar)
                  ? {
                      ...errorBar,
                      style: valueOrDefault(
                        errorBar.style,
                        { ...defaultErrorBarStyle(), color: baseColor },
                      ),
                    }
                  : errorBar,
              ]),
            )
          : item.errorBars
        return {
          ...item,
          barBindings: valueOrDefault(
            item.barBindings,
            {
              category: isRecord(item.bindings)
                ? item.bindings.x ?? null
                : null,
              value: isRecord(item.bindings) ? item.bindings.y ?? null : null,
              error:
                isRecord(item.errorBars) &&
                isRecord(item.errorBars.y) &&
                isRecord(item.errorBars.y.value)
                  ? item.errorBars.y.value.source ?? null
                  : null,
            },
          ),
          barRowBindings: valueOrDefault(
            item.barRowBindings,
            defaultBarRowBindings(),
          ),
          style: { ...style, line, marker, bar },
          errorBars,
        }
      })
    : chart.series
  const title = isRecord(chart.title)
    ? {
        ...chart.title,
        style: valueOrDefault(chart.title.style, defaultTitleStyle()),
      }
    : chart.title
  return {
    ...value,
    chart: {
      ...chart,
      dataOrientation: valueOrDefault(chart.dataOrientation, 'columns'),
      bar: valueOrDefault(chart.bar, defaultBarOptions()),
      axes,
      series,
      title,
      style: valueOrDefault(chart.style, defaultChartStyle()),
    },
  }
}

function isDataRange(value: unknown): value is DataRangeRef {
  if (!isRecord(value) || !isRecord(value.rows)) return false
  if (
    typeof value.datasetId !== 'string' ||
    typeof value.columnId !== 'string'
  ) {
    return false
  }
  if (value.rows.kind === 'all') return true
  return (
    value.rows.kind === 'range' &&
    typeof value.rows.startRowId === 'string' &&
    typeof value.rows.endRowId === 'string'
  )
}

function isDataRangeOrNull(value: unknown): value is DataRangeRef | null {
  return value === null || isDataRange(value)
}

function isBarRowBindings(value: unknown): boolean {
  if (!isRecord(value)) return false
  const nullableString = (candidate: unknown) =>
    candidate === null || typeof candidate === 'string'
  return (
    nullableString(value.datasetId) &&
    nullableString(value.categoryStartColumnId) &&
    nullableString(value.categoryEndColumnId) &&
    nullableString(value.valueRowId) &&
    nullableString(value.errorRowId) &&
    nullableString(value.labelColumnId)
  )
}

function isDataset(value: unknown): value is DatasetModel {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.columns) ||
    !Array.isArray(value.rows) ||
    !hasValidExtensions(value)
  ) {
    return false
  }

  const columnsAreValid = value.columns.every(
    (column) =>
      isRecord(column) &&
      typeof column.id === 'string' &&
      typeof column.name === 'string',
  )
  const rowsAreValid = value.rows.every(
    (row) =>
      isRecord(row) &&
      typeof row.id === 'string' &&
      isRecord(row.cells) &&
      Object.values(row.cells).every(isCellValue),
  )
  return columnsAreValid && rowsAreValid
}

function isAxis(value: unknown): value is AxisModel {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.dimension !== 'x' && value.dimension !== 'y') ||
    (value.position !== 'bottom' && value.position !== 'left') ||
    !isRecord(value.title) ||
    typeof value.title.visible !== 'boolean' ||
    typeof value.title.text !== 'string' ||
    !isRecord(value.scale) ||
    (value.scale.type !== 'linear' && value.scale.type !== 'log') ||
    !isFiniteNumberOrNull(value.scale.minimum) ||
    !isFiniteNumberOrNull(value.scale.maximum) ||
    typeof value.scale.reversed !== 'boolean' ||
    !isRecord(value.ticks) ||
    !isRecord(value.ticks.majorInterval) ||
    !isRecord(value.ticks.minorInterval) ||
    typeof value.ticks.majorVisible !== 'boolean' ||
    typeof value.ticks.minorVisible !== 'boolean' ||
    !['inside', 'outside', 'cross', 'none'].includes(
      String(value.ticks.direction),
    ) ||
    !isRecord(value.gridLines) ||
    typeof value.gridLines.majorVisible !== 'boolean' ||
    typeof value.gridLines.minorVisible !== 'boolean' ||
    !isRecord(value.line) ||
    typeof value.line.visible !== 'boolean' ||
    typeof value.line.color !== 'string' ||
    typeof value.line.widthPx !== 'number' ||
    !isRecord(value.labels) ||
    typeof value.labels.family !== 'string' ||
    typeof value.labels.sizePx !== 'number' ||
    typeof value.labels.color !== 'string' ||
    !isRecord(value.numberFormat) ||
    value.numberFormat.kind !== 'auto' ||
    !hasValidExtensions(value)
  ) {
    return false
  }

  const majorInterval = value.ticks.majorInterval
  const minorInterval = value.ticks.minorInterval
  const majorValid =
    majorInterval.mode === 'auto' ||
    (majorInterval.mode === 'fixed' &&
      typeof majorInterval.step === 'number' &&
      Number.isFinite(majorInterval.step))
  const minorValid =
    minorInterval.mode === 'none' ||
    minorInterval.mode === 'auto' ||
    (minorInterval.mode === 'fixed' &&
      typeof minorInterval.step === 'number' &&
      Number.isFinite(minorInterval.step))
  return (
    majorValid &&
    minorValid &&
    Number.isFinite(value.line.widthPx) &&
    Number.isFinite(value.labels.sizePx)
  )
}

function isErrorBar(value: unknown): value is ErrorBarModel {
  if (
    !isRecord(value) ||
    typeof value.enabled !== 'boolean' ||
    !isRecord(value.style) ||
    typeof value.style.visible !== 'boolean' ||
    typeof value.style.color !== 'string' ||
    typeof value.style.widthPx !== 'number' ||
    !Number.isFinite(value.style.widthPx) ||
    typeof value.style.capSizePx !== 'number' ||
    !Number.isFinite(value.style.capSizePx)
  ) return false
  if (value.value === null) return true
  return isRecord(value.value) && value.value.kind === 'symmetric' && isDataRange(value.value.source)
}

function isSeries(value: unknown): value is SeriesModel {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.visible !== 'boolean' ||
    !isRecord(value.bindings) ||
    !isDataRangeOrNull(value.bindings.x) ||
    !isDataRangeOrNull(value.bindings.y) ||
    !isRecord(value.barBindings) ||
    !isDataRangeOrNull(value.barBindings.category) ||
    !isDataRangeOrNull(value.barBindings.value) ||
    !isDataRangeOrNull(value.barBindings.error) ||
    !isBarRowBindings(value.barRowBindings) ||
    !isRecord(value.axisIds) ||
    typeof value.axisIds.x !== 'string' ||
    typeof value.axisIds.y !== 'string' ||
    !isRecord(value.style) ||
    typeof value.style.color !== 'string' ||
    !isRecord(value.style.line) ||
    typeof value.style.line.visible !== 'boolean' ||
    typeof value.style.line.color !== 'string' ||
    typeof value.style.line.widthPx !== 'number' ||
    !['solid', 'dash', 'dot', 'dash-dot'].includes(String(value.style.line.dash)) ||
    !isRecord(value.style.marker) ||
    typeof value.style.marker.visible !== 'boolean' ||
    !['circle', 'square', 'diamond', 'triangle-up', 'cross', 'x'].includes(String(value.style.marker.shape)) ||
    typeof value.style.marker.sizePx !== 'number' ||
    typeof value.style.marker.fillColor !== 'string' ||
    typeof value.style.marker.borderColor !== 'string' ||
    typeof value.style.marker.borderWidthPx !== 'number' ||
    !isRecord(value.style.bar) ||
    typeof value.style.bar.fillColor !== 'string' ||
    typeof value.style.bar.borderColor !== 'string' ||
    typeof value.style.bar.borderWidthPx !== 'number' ||
    typeof value.style.bar.opacity !== 'number' ||
    typeof value.style.bar.widthRatio !== 'number' ||
    !isRecord(value.errorBars) ||
    !isErrorBar(value.errorBars.x) ||
    !isErrorBar(value.errorBars.y) ||
    !Array.isArray(value.trendlines) ||
    value.trendlines.length !== 0 ||
    !hasValidExtensions(value)
  ) {
    return false
  }

  return (
    Number.isFinite(value.style.line.widthPx) &&
    Number.isFinite(value.style.marker.sizePx) &&
    Number.isFinite(value.style.marker.borderWidthPx) &&
    Number.isFinite(value.style.bar.borderWidthPx) &&
    Number.isFinite(value.style.bar.opacity) &&
    Number.isFinite(value.style.bar.widthRatio)
  )
}

function isProjectState(value: unknown): value is ProjectState {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isRecord(value.metadata) ||
    typeof value.metadata.title !== 'string' ||
    typeof value.metadata.createdAt !== 'string' ||
    typeof value.metadata.updatedAt !== 'string' ||
    !Array.isArray(value.datasets) ||
    !value.datasets.every(isDataset) ||
    !isRecord(value.chart) ||
    typeof value.chart.id !== 'string' ||
    (value.chart.type !== 'scatter' && value.chart.type !== 'bar') ||
    (value.chart.dataOrientation !== 'columns' &&
      value.chart.dataOrientation !== 'rows') ||
    !isRecord(value.chart.bar) ||
    (value.chart.bar.orientation !== 'vertical' &&
      value.chart.bar.orientation !== 'horizontal') ||
    typeof value.chart.bar.gapRatio !== 'number' ||
    !Number.isFinite(value.chart.bar.gapRatio) ||
    !isRecord(value.chart.title) ||
    typeof value.chart.title.visible !== 'boolean' ||
    typeof value.chart.title.text !== 'string' ||
    !isRecord(value.chart.title.style) ||
    typeof value.chart.title.style.family !== 'string' ||
    typeof value.chart.title.style.sizePx !== 'number' ||
    typeof value.chart.title.style.color !== 'string' ||
    typeof value.chart.title.style.bold !== 'boolean' ||
    !isRecord(value.chart.legend) ||
    typeof value.chart.legend.visible !== 'boolean' ||
    !['right', 'left', 'top', 'bottom'].includes(String(value.chart.legend.position)) ||
    !isRecord(value.chart.size) ||
    typeof value.chart.size.widthPx !== 'number' ||
    !Number.isFinite(value.chart.size.widthPx) ||
    typeof value.chart.size.heightPx !== 'number' ||
    !Number.isFinite(value.chart.size.heightPx) ||
    !isRecord(value.chart.style) ||
    typeof value.chart.style.backgroundColor !== 'string' ||
    typeof value.chart.style.plotBackgroundColor !== 'string' ||
    !Array.isArray(value.chart.axes) ||
    !value.chart.axes.every(isAxis) ||
    !Array.isArray(value.chart.series) ||
    !value.chart.series.every(isSeries) ||
    !Array.isArray(value.chart.annotations) ||
    value.chart.annotations.length !== 0 ||
    !hasValidExtensions(value.chart) ||
    !hasValidExtensions(value)
  ) {
    return false
  }
  return Number.isFinite(value.chart.title.style.sizePx)
}

function parseFailure(
  code: string,
  path: string,
  message: string,
): ProjectParseResult {
  return { ok: false, error: { code, path, message } }
}

function validateFileShape(value: unknown): ProjectParseResult {
  if (!isRecord(value)) {
    return parseFailure('schema.root', '$', 'トップレベルはobjectである必要があります。')
  }
  if (value.app !== 'scientific-chart-editor') {
    return parseFailure('schema.app', '$.app', 'Scientific Chart Editorのファイルではありません。')
  }
  if (value.schemaVersion !== '0.1') {
    return parseFailure('schema.version', '$.schemaVersion', '対応しているschemaVersionは0.1です。')
  }
  const hydratedProject = hydrateProjectV01(value.project)
  if (!isProjectState(hydratedProject)) {
    return parseFailure('schema.project', '$.project', 'projectの必須構造または値の型が不正です。')
  }

  const semanticIssues = validateProjectSemantics(hydratedProject)
  if (semanticIssues.length > 0) return { ok: false, error: semanticIssues[0] }
  return { ok: true, project: hydratedProject }
}

export function parseProjectFile(text: string): ProjectParseResult {
  if (new TextEncoder().encode(text).byteLength > DATA_LIMITS.maxProjectFileBytes) {
    return parseFailure('file.size', '$', 'プロジェクトファイルは5 MiB以下にしてください。')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return parseFailure('json.syntax', '$', 'JSONの構文が壊れています。')
  }
  return validateFileShape(parsed)
}

export class ProjectSerializationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super(issues[0]?.message ?? 'プロジェクトを保存できません。')
    this.name = 'ProjectSerializationError'
    this.issues = issues
  }
}

export function serializeProjectFile(project: ProjectState): string {
  const issues = validateProjectSemantics(project)
  if (issues.length > 0) throw new ProjectSerializationError(issues)
  const file: ProjectFileV01 = {
    schemaVersion: '0.1',
    app: 'scientific-chart-editor',
    project,
  }
  return JSON.stringify(file, null, 2)
}

export function loadProjectAtomically(
  currentProject: ProjectState,
  text: string,
): { project: ProjectState; error: ValidationIssue | null } {
  const result = parseProjectFile(text)
  if (!result.ok) return { project: currentProject, error: result.error }
  return { project: result.project, error: null }
}
