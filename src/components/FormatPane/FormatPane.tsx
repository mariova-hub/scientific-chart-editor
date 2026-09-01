import type {
  AxisDimension,
  AxisModel,
  ProjectState,
  ValidationIssue,
} from '../../model/types'
import { CHART_SIZE_LIMITS } from '../../model/limits'

interface FormatPaneProps {
  project: ProjectState
  issues: ValidationIssue[]
  onAxisTitle: (dimension: AxisDimension, value: string) => void
  onAxisBound: (
    dimension: AxisDimension,
    bound: 'minimum' | 'maximum',
    value: number | null,
  ) => void
  onMajorUnit: (dimension: AxisDimension, value: number | null) => void
  onChartTitle: (value: string) => void
  onChartSize: (dimension: 'widthPx' | 'heightPx', value: number) => void
}

function nullableNumber(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function FormatPane({
  project,
  issues,
  onAxisTitle,
  onAxisBound,
  onMajorUnit,
  onChartTitle,
  onChartSize,
}: FormatPaneProps) {
  const xAxis = project.chart.axes.find((axis) => axis.dimension === 'x')
  const yAxis = project.chart.axes.find((axis) => axis.dimension === 'y')

  return (
    <aside className="workspace-panel format-panel" aria-labelledby="format-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Format</span>
          <h2 id="format-heading">書式設定</h2>
        </div>
      </div>

      <fieldset>
        <legend>グラフ</legend>
        <label className="control-label">
          <span>タイトル</span>
          <input
            type="text"
            value={project.chart.title.text}
            onChange={(event) => onChartTitle(event.target.value)}
          />
        </label>
      </fieldset>

      {xAxis && (
        <AxisControls
          axis={xAxis}
          label="X軸"
          onTitle={onAxisTitle}
          onBound={onAxisBound}
          onMajorUnit={onMajorUnit}
        />
      )}
      {yAxis && (
        <AxisControls
          axis={yAxis}
          label="Y軸"
          onTitle={onAxisTitle}
          onBound={onAxisBound}
          onMajorUnit={onMajorUnit}
        />
      )}

      <fieldset>
        <legend>サイズ</legend>
        <label className="control-label">
          <span>幅 (px)</span>
          <input
            type="number"
            min={CHART_SIZE_LIMITS.minWidthPx}
            max={CHART_SIZE_LIMITS.maxWidthPx}
            value={project.chart.size.widthPx}
            onChange={(event) =>
              onChartSize('widthPx', Number(event.target.value))
            }
          />
        </label>
        <label className="control-label">
          <span>高さ (px)</span>
          <input
            type="number"
            min={CHART_SIZE_LIMITS.minHeightPx}
            max={CHART_SIZE_LIMITS.maxHeightPx}
            value={project.chart.size.heightPx}
            onChange={(event) =>
              onChartSize('heightPx', Number(event.target.value))
            }
          />
        </label>
        <p className="muted-note">
          幅 {CHART_SIZE_LIMITS.minWidthPx}〜{CHART_SIZE_LIMITS.maxWidthPx}px / 高さ{' '}
          {CHART_SIZE_LIMITS.minHeightPx}〜{CHART_SIZE_LIMITS.maxHeightPx}px
        </p>
      </fieldset>

      {issues.length > 0 && (
        <div className="validation-box" role="alert">
          <strong>保存前に確認してください</strong>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

interface AxisControlsProps {
  axis: AxisModel
  label: string
  onTitle: (dimension: AxisDimension, value: string) => void
  onBound: (
    dimension: AxisDimension,
    bound: 'minimum' | 'maximum',
    value: number | null,
  ) => void
  onMajorUnit: (dimension: AxisDimension, value: number | null) => void
}

function AxisControls({
  axis,
  label,
  onTitle,
  onBound,
  onMajorUnit,
}: AxisControlsProps) {
  const majorUnit =
    axis.ticks.majorInterval.mode === 'fixed'
      ? axis.ticks.majorInterval.step
      : null

  return (
    <fieldset>
      <legend>{label}</legend>
      <label className="control-label">
        <span>タイトル</span>
        <input
          type="text"
          value={axis.title.text}
          onChange={(event) => onTitle(axis.dimension, event.target.value)}
        />
      </label>
      <div className="two-column-controls">
        <label className="control-label">
          <span>最小値</span>
          <input
            type="number"
            placeholder="Auto"
            value={axis.scale.minimum ?? ''}
            onChange={(event) =>
              onBound(axis.dimension, 'minimum', nullableNumber(event.target.value))
            }
          />
        </label>
        <label className="control-label">
          <span>最大値</span>
          <input
            type="number"
            placeholder="Auto"
            value={axis.scale.maximum ?? ''}
            onChange={(event) =>
              onBound(axis.dimension, 'maximum', nullableNumber(event.target.value))
            }
          />
        </label>
      </div>
      <label className="control-label">
        <span>主目盛</span>
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Auto"
          value={majorUnit ?? ''}
          onChange={(event) =>
            onMajorUnit(axis.dimension, nullableNumber(event.target.value))
          }
        />
      </label>
    </fieldset>
  )
}
