import { DATA_LIMITS } from '../model/limits'
import { validateProjectSemantics } from '../model/projectValidation'
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
    value.scale.type !== 'linear' ||
    !isFiniteNumberOrNull(value.scale.minimum) ||
    !isFiniteNumberOrNull(value.scale.maximum) ||
    typeof value.scale.reversed !== 'boolean' ||
    !isRecord(value.ticks) ||
    !isRecord(value.ticks.majorInterval) ||
    !isRecord(value.ticks.minorInterval) ||
    value.ticks.minorInterval.mode !== 'none' ||
    value.ticks.direction !== 'outside' ||
    !isRecord(value.gridLines) ||
    typeof value.gridLines.majorVisible !== 'boolean' ||
    typeof value.gridLines.minorVisible !== 'boolean' ||
    !isRecord(value.numberFormat) ||
    value.numberFormat.kind !== 'auto' ||
    !hasValidExtensions(value)
  ) {
    return false
  }

  const majorInterval = value.ticks.majorInterval
  return (
    majorInterval.mode === 'auto' ||
    (majorInterval.mode === 'fixed' &&
      typeof majorInterval.step === 'number' &&
      Number.isFinite(majorInterval.step))
  )
}

function isErrorBar(value: unknown): value is ErrorBarModel {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') return false
  if (value.value === null) return true
  return (
    isRecord(value.value) &&
    value.value.kind === 'symmetric' &&
    isDataRange(value.value.source)
  )
}

function isSeries(value: unknown): value is SeriesModel {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.visible !== 'boolean' ||
    !isRecord(value.bindings) ||
    !isDataRange(value.bindings.x) ||
    !isDataRange(value.bindings.y) ||
    !isRecord(value.axisIds) ||
    typeof value.axisIds.x !== 'string' ||
    typeof value.axisIds.y !== 'string' ||
    !isRecord(value.style) ||
    typeof value.style.color !== 'string' ||
    !isRecord(value.style.line) ||
    typeof value.style.line.visible !== 'boolean' ||
    typeof value.style.line.widthPx !== 'number' ||
    value.style.line.dash !== 'solid' ||
    !isRecord(value.style.marker) ||
    typeof value.style.marker.visible !== 'boolean' ||
    value.style.marker.shape !== 'circle' ||
    typeof value.style.marker.sizePx !== 'number' ||
    !isRecord(value.style.bar) ||
    typeof value.style.bar.fillColor !== 'string' ||
    typeof value.style.bar.borderColor !== 'string' ||
    typeof value.style.bar.borderWidthPx !== 'number' ||
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
    Number.isFinite(value.style.bar.borderWidthPx)
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
    value.chart.type !== 'scatter' ||
    !isRecord(value.chart.title) ||
    typeof value.chart.title.visible !== 'boolean' ||
    typeof value.chart.title.text !== 'string' ||
    !isRecord(value.chart.legend) ||
    typeof value.chart.legend.visible !== 'boolean' ||
    value.chart.legend.position !== 'right' ||
    !isRecord(value.chart.size) ||
    typeof value.chart.size.widthPx !== 'number' ||
    !Number.isFinite(value.chart.size.widthPx) ||
    typeof value.chart.size.heightPx !== 'number' ||
    !Number.isFinite(value.chart.size.heightPx) ||
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
  return true
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
  if (!isProjectState(value.project)) {
    return parseFailure('schema.project', '$.project', 'projectの必須構造または値の型が不正です。')
  }

  const semanticIssues = validateProjectSemantics(value.project)
  if (semanticIssues.length > 0) return { ok: false, error: semanticIssues[0] }
  return { ok: true, project: value.project }
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
