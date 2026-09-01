import { useState } from 'react'
import { CHART_SIZE_LIMITS, STYLE_LIMITS } from '../../model/limits'
import { isCategoryAxis } from '../../model/dataBinding'
import type {
  AxisModel,
  FontStyleModel,
  ProjectState,
  ValidationIssue,
} from '../../model/types'
import type { ProjectAction } from '../../state/projectReducer'
import {
  selectionFromKey,
  selectionKey,
  type ChartSelection,
} from '../../state/selection'

interface FormatPaneProps {
  project: ProjectState
  selection: ChartSelection
  issues: ValidationIssue[]
  warnings: ValidationIssue[]
  onSelectionChange: (selection: ChartSelection) => void
  onAction: (action: ProjectAction) => void
}

const FONT_FAMILIES = ['Arial', 'Inter', 'Times New Roman', 'Georgia', 'Verdana']

export function FormatPane({
  project,
  selection,
  issues,
  warnings,
  onSelectionChange,
  onAction,
}: FormatPaneProps) {
  const selectedAxis =
    selection.type === 'axis'
      ? project.chart.axes.find((axis) => axis.id === selection.axisId)
      : undefined
  const selectedSeries =
    selection.type === 'series' || selection.type === 'error-bars'
      ? project.chart.series.find((series) => series.id === selection.seriesId)
      : undefined

  return (
    <aside className="workspace-panel format-panel" aria-labelledby="format-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Format</span>
          <h2 id="format-heading">グラフの書式設定</h2>
        </div>
      </div>

      <label className="control-label target-selector">
        <span>書式設定対象</span>
        <select
          value={selectionKey(selection)}
          onChange={(event) =>
            onSelectionChange(selectionFromKey(project, event.target.value))
          }
        >
          <option value={`chart:${project.chart.id}`}>グラフ</option>
          {project.chart.axes.map((axis) => (
            <option value={`axis:${axis.id}`} key={axis.id}>
              {axis.dimension === 'x' ? 'X軸' : 'Y軸'}
            </option>
          ))}
          {project.chart.series.map((series) => (
            <option value={`series:${series.id}`} key={series.id}>
              データ系列
            </option>
          ))}
          {project.chart.series.map((series) => (
            <option value={`error-bars:${series.id}:value`} key={`${series.id}-error`}>
              {project.chart.type === 'bar' ? '誤差範囲' : 'Y誤差範囲'}
            </option>
          ))}
          <option value={`legend:${project.chart.id}`}>凡例</option>
          <option value={`chart-title:${project.chart.id}`}>グラフタイトル</option>
        </select>
      </label>

      <div className="format-target-name">
        対象: <strong>{selectionLabel(project, selection)}</strong>
      </div>

      {selection.type === 'chart' && (
        <ChartControls project={project} onAction={onAction} />
      )}
      {selectedAxis && (
        <AxisControls project={project} axis={selectedAxis} onAction={onAction} />
      )}
      {selection.type === 'series' && selectedSeries && (
        <SeriesControls project={project} series={selectedSeries} onAction={onAction} />
      )}
      {selection.type === 'error-bars' && selectedSeries && (
        <ErrorBarControls series={selectedSeries} onAction={onAction} />
      )}
      {selection.type === 'legend' && (
        <LegendControls project={project} onAction={onAction} />
      )}
      {selection.type === 'chart-title' && (
        <TitleControls project={project} onAction={onAction} />
      )}

      {issues.length > 0 && (
        <div className="validation-box" role="alert">
          <strong>設定を確認してください</strong>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="warning-box" role="status">
          <strong>グラフの注意</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={`${warning.code}-${warning.path}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

function selectionLabel(project: ProjectState, selection: ChartSelection): string {
  if (selection.type === 'chart') return 'グラフ'
  if (selection.type === 'axis') {
    return project.chart.axes.find((axis) => axis.id === selection.axisId)
      ?.dimension === 'x'
      ? 'X軸'
      : 'Y軸'
  }
  if (selection.type === 'series') return 'データ系列'
  if (selection.type === 'error-bars') {
    return project.chart.type === 'bar' ? '誤差範囲' : 'Y誤差範囲'
  }
  if (selection.type === 'legend') return '凡例'
  return 'グラフタイトル'
}

function ChartControls({
  project,
  onAction,
}: {
  project: ProjectState
  onAction: (action: ProjectAction) => void
}) {
  return (
    <>
      <fieldset>
        <legend>グラフの種類</legend>
        <label className="control-label">
          <span>種類</span>
          <select
            value={project.chart.type}
            onChange={(event) =>
              onAction({
                type: 'set-chart-type',
                value: event.target.value as ProjectState['chart']['type'],
              })
            }
          >
            <option value="scatter">散布図</option>
            <option value="bar">棒グラフ</option>
          </select>
        </label>
        {project.chart.type === 'bar' && (
          <>
            <div className="orientation-control" role="radiogroup" aria-label="棒グラフの方向">
              <label>
                <input
                  type="radio"
                  name="bar-orientation"
                  value="vertical"
                  checked={project.chart.bar.orientation === 'vertical'}
                  onChange={() =>
                    onAction({ type: 'set-bar-orientation', value: 'vertical' })
                  }
                />
                縦棒
              </label>
              <label>
                <input
                  type="radio"
                  name="bar-orientation"
                  value="horizontal"
                  checked={project.chart.bar.orientation === 'horizontal'}
                  onChange={() =>
                    onAction({ type: 'set-bar-orientation', value: 'horizontal' })
                  }
                />
                横棒
              </label>
            </div>
            <NumberDraftInput
              label="棒の間隔"
              value={project.chart.bar.gapRatio}
              minimum={0}
              maximum={0.9}
              onCommit={(value) => {
                if (value !== null) onAction({ type: 'set-bar-gap', value })
              }}
            />
          </>
        )}
      </fieldset>
      <fieldset>
        <legend>塗りつぶし</legend>
        <ColorControl
          label="グラフ背景"
          value={project.chart.style.backgroundColor}
          onChange={(value) =>
            onAction({ type: 'set-chart-background', field: 'backgroundColor', value })
          }
        />
        <ColorControl
          label="プロット領域"
          value={project.chart.style.plotBackgroundColor}
          onChange={(value) =>
            onAction({ type: 'set-chart-background', field: 'plotBackgroundColor', value })
          }
        />
      </fieldset>
      <fieldset>
        <legend>サイズ</legend>
        <NumberDraftInput
          label="幅 (px)"
          value={project.chart.size.widthPx}
          minimum={CHART_SIZE_LIMITS.minWidthPx}
          maximum={CHART_SIZE_LIMITS.maxWidthPx}
          integer
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-chart-size', dimension: 'widthPx', value })
          }}
        />
        <NumberDraftInput
          label="高さ (px)"
          value={project.chart.size.heightPx}
          minimum={CHART_SIZE_LIMITS.minHeightPx}
          maximum={CHART_SIZE_LIMITS.maxHeightPx}
          integer
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-chart-size', dimension: 'heightPx', value })
          }}
        />
        <p className="muted-note">
          数値入力とグラフ右下のリサイズハンドルは同期します。
        </p>
      </fieldset>
    </>
  )
}

function AxisControls({
  project,
  axis,
  onAction,
}: {
  project: ProjectState
  axis: AxisModel
  onAction: (action: ProjectAction) => void
}) {
  const majorUnit = axis.ticks.majorInterval.mode === 'fixed'
    ? axis.ticks.majorInterval.step
    : null
  const minorUnit = axis.ticks.minorInterval.mode === 'fixed'
    ? axis.ticks.minorInterval.step
    : null
  const categoryAxis = isCategoryAxis(project, axis.dimension)

  return (
    <>
      <fieldset>
        <legend>軸のオプション</legend>
        <label className="control-label">
          <span>軸タイトル</span>
          <input
            type="text"
            value={axis.title.text}
            onChange={(event) =>
              onAction({ type: 'set-axis-title', axisId: axis.id, title: event.target.value })
            }
          />
        </label>
        {categoryAxis ? (
          <p className="muted-note category-axis-note">
            この軸はカテゴリ軸です。最小値・最大値・目盛間隔・対数設定は適用されません。
          </p>
        ) : (
          <>
        <div className="two-column-controls">
          <NumberDraftInput
            label="最小値"
            value={axis.scale.minimum}
            allowAuto
            onCommit={(value) =>
              onAction({ type: 'set-axis-bound', axisId: axis.id, bound: 'minimum', value })
            }
          />
          <NumberDraftInput
            label="最大値"
            value={axis.scale.maximum}
            allowAuto
            onCommit={(value) =>
              onAction({ type: 'set-axis-bound', axisId: axis.id, bound: 'maximum', value })
            }
          />
        </div>
        <label className="control-label">
          <span>スケール</span>
          <select
            value={axis.scale.type}
            onChange={(event) =>
              onAction({
                type: 'set-axis-scale-type',
                axisId: axis.id,
                value: event.target.value as AxisModel['scale']['type'],
              })
            }
          >
            <option value="linear">線形</option>
            <option value="log">対数</option>
          </select>
        </label>
        <CheckboxControl
          label="軸を反転"
          checked={axis.scale.reversed}
          onChange={(value) =>
            onAction({ type: 'set-axis-reversed', axisId: axis.id, value })
          }
        />
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>目盛</legend>
        {!categoryAxis && <NumberDraftInput
          label="主目盛間隔"
          value={majorUnit}
          allowAuto
          minimum={Number.EPSILON}
          onCommit={(value) =>
            onAction({ type: 'set-axis-major-unit', axisId: axis.id, value })
          }
        />}
        {!categoryAxis && <NumberDraftInput
          label="補助目盛間隔"
          value={minorUnit}
          allowAuto
          minimum={Number.EPSILON}
          onCommit={(value) =>
            onAction({ type: 'set-axis-minor-unit', axisId: axis.id, value })
          }
        />}
        <div className="two-column-controls">
          <CheckboxControl
            label="主目盛を表示"
            checked={axis.ticks.majorVisible}
            onChange={(visible) =>
              onAction({ type: 'set-axis-tick-visible', axisId: axis.id, kind: 'major', visible })
            }
          />
          {!categoryAxis && <CheckboxControl
            label="補助目盛を表示"
            checked={axis.ticks.minorVisible}
            onChange={(visible) =>
              onAction({ type: 'set-axis-tick-visible', axisId: axis.id, kind: 'minor', visible })
            }
          />}
        </div>
        <label className="control-label">
          <span>目盛方向</span>
          <select
            value={axis.ticks.direction}
            onChange={(event) =>
              onAction({
                type: 'set-axis-tick-direction',
                axisId: axis.id,
                value: event.target.value as AxisModel['ticks']['direction'],
              })
            }
          >
            <option value="inside">内向き</option>
            <option value="outside">外向き</option>
            <option value="cross">交差</option>
            <option value="none">なし</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>軸線とグリッド線</legend>
        <CheckboxControl
          label="軸線を表示"
          checked={axis.line.visible}
          onChange={(value) =>
            onAction({ type: 'set-axis-line', axisId: axis.id, field: 'visible', value })
          }
        />
        <ColorControl
          label="軸線の色"
          value={axis.line.color}
          onChange={(value) =>
            onAction({ type: 'set-axis-line', axisId: axis.id, field: 'color', value })
          }
        />
        <NumberDraftInput
          label="軸線の太さ"
          value={axis.line.widthPx}
          minimum={STYLE_LIMITS.minLineWidthPx}
          maximum={STYLE_LIMITS.maxLineWidthPx}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-axis-line', axisId: axis.id, field: 'widthPx', value })
          }}
        />
        <div className="two-column-controls">
          <CheckboxControl
            label="主グリッド"
            checked={axis.gridLines.majorVisible}
            onChange={(visible) =>
              onAction({ type: 'set-axis-grid-visible', axisId: axis.id, kind: 'major', visible })
            }
          />
          {!categoryAxis && <CheckboxControl
            label="補助グリッド"
            checked={axis.gridLines.minorVisible}
            onChange={(visible) =>
              onAction({ type: 'set-axis-grid-visible', axisId: axis.id, kind: 'minor', visible })
            }
          />}
        </div>
      </fieldset>

      <FontControls
        legend="軸ラベル"
        style={axis.labels}
        onChange={(field, value) =>
          onAction({ type: 'set-axis-label-style', axisId: axis.id, field, value })
        }
      />
    </>
  )
}

function SeriesControls({
  project,
  series,
  onAction,
}: {
  project: ProjectState
  series: ProjectState['chart']['series'][number]
  onAction: (action: ProjectAction) => void
}) {
  if (project.chart.type === 'bar') {
    return (
      <fieldset>
        <legend>棒の書式</legend>
        <ColorControl
          label="塗りつぶし"
          value={series.style.bar.fillColor}
          onChange={(value) =>
            onAction({ type: 'set-series-bar', seriesId: series.id, field: 'fillColor', value })
          }
        />
        <ColorControl
          label="枠線色"
          value={series.style.bar.borderColor}
          onChange={(value) =>
            onAction({ type: 'set-series-bar', seriesId: series.id, field: 'borderColor', value })
          }
        />
        <NumberDraftInput
          label="枠線幅"
          value={series.style.bar.borderWidthPx}
          minimum={STYLE_LIMITS.minBorderWidthPx}
          maximum={STYLE_LIMITS.maxBorderWidthPx}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-bar', seriesId: series.id, field: 'borderWidthPx', value })
          }}
        />
        <NumberDraftInput
          label="不透明度"
          value={series.style.bar.opacity}
          minimum={0}
          maximum={1}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-bar', seriesId: series.id, field: 'opacity', value })
          }}
        />
        <NumberDraftInput
          label="棒の幅"
          value={series.style.bar.widthRatio}
          minimum={0.05}
          maximum={1}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-bar', seriesId: series.id, field: 'widthRatio', value })
          }}
        />
        <p className="muted-note">棒の幅と間隔は0〜1の比率で指定します。</p>
      </fieldset>
    )
  }
  return (
    <>
      <fieldset>
        <legend>マーカー</legend>
        <CheckboxControl
          label="マーカーを表示"
          checked={series.style.marker.visible}
          onChange={(value) =>
            onAction({ type: 'set-series-marker', seriesId: series.id, field: 'visible', value })
          }
        />
        <label className="control-label">
          <span>形</span>
          <select
            value={series.style.marker.shape}
            onChange={(event) =>
              onAction({ type: 'set-series-marker', seriesId: series.id, field: 'shape', value: event.target.value })
            }
          >
            <option value="circle">円</option>
            <option value="square">四角</option>
            <option value="diamond">ひし形</option>
            <option value="triangle-up">三角</option>
            <option value="cross">十字</option>
            <option value="x">X</option>
          </select>
        </label>
        <NumberDraftInput
          label="サイズ"
          value={series.style.marker.sizePx}
          minimum={STYLE_LIMITS.minMarkerSizePx}
          maximum={STYLE_LIMITS.maxMarkerSizePx}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-marker', seriesId: series.id, field: 'sizePx', value })
          }}
        />
        <ColorControl
          label="塗り色"
          value={series.style.marker.fillColor}
          onChange={(value) =>
            onAction({ type: 'set-series-marker', seriesId: series.id, field: 'fillColor', value })
          }
        />
        <ColorControl
          label="枠線色"
          value={series.style.marker.borderColor}
          onChange={(value) =>
            onAction({ type: 'set-series-marker', seriesId: series.id, field: 'borderColor', value })
          }
        />
        <NumberDraftInput
          label="枠線幅"
          value={series.style.marker.borderWidthPx}
          minimum={STYLE_LIMITS.minBorderWidthPx}
          maximum={STYLE_LIMITS.maxBorderWidthPx}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-marker', seriesId: series.id, field: 'borderWidthPx', value })
          }}
        />
      </fieldset>
      <fieldset>
        <legend>線</legend>
        <CheckboxControl
          label="線を表示"
          checked={series.style.line.visible}
          onChange={(value) =>
            onAction({ type: 'set-series-line', seriesId: series.id, field: 'visible', value })
          }
        />
        <ColorControl
          label="線の色"
          value={series.style.line.color}
          onChange={(value) =>
            onAction({ type: 'set-series-line', seriesId: series.id, field: 'color', value })
          }
        />
        <NumberDraftInput
          label="線幅"
          value={series.style.line.widthPx}
          minimum={STYLE_LIMITS.minLineWidthPx}
          maximum={STYLE_LIMITS.maxLineWidthPx}
          onCommit={(value) => {
            if (value !== null) onAction({ type: 'set-series-line', seriesId: series.id, field: 'widthPx', value })
          }}
        />
        <label className="control-label">
          <span>線種</span>
          <select
            value={series.style.line.dash}
            onChange={(event) =>
              onAction({ type: 'set-series-line', seriesId: series.id, field: 'dash', value: event.target.value })
            }
          >
            <option value="solid">実線</option>
            <option value="dash">破線</option>
            <option value="dot">点線</option>
            <option value="dash-dot">一点鎖線</option>
          </select>
        </label>
      </fieldset>
    </>
  )
}

function ErrorBarControls({
  series,
  onAction,
}: {
  series: ProjectState['chart']['series'][number]
  onAction: (action: ProjectAction) => void
}) {
  const style = series.errorBars.y.style
  return (
    <fieldset>
      <legend>誤差範囲</legend>
      <CheckboxControl
        label="表示"
        checked={style.visible}
        onChange={(value) =>
          onAction({ type: 'set-error-bar-style', seriesId: series.id, field: 'visible', value })
        }
      />
      <ColorControl
        label="色"
        value={style.color}
        onChange={(value) =>
          onAction({ type: 'set-error-bar-style', seriesId: series.id, field: 'color', value })
        }
      />
      <NumberDraftInput
        label="線幅"
        value={style.widthPx}
        minimum={STYLE_LIMITS.minLineWidthPx}
        maximum={STYLE_LIMITS.maxLineWidthPx}
        onCommit={(value) => {
          if (value !== null) onAction({ type: 'set-error-bar-style', seriesId: series.id, field: 'widthPx', value })
        }}
      />
      <NumberDraftInput
        label="キャップサイズ"
        value={style.capSizePx}
        minimum={STYLE_LIMITS.minCapSizePx}
        maximum={STYLE_LIMITS.maxCapSizePx}
        onCommit={(value) => {
          if (value !== null) onAction({ type: 'set-error-bar-style', seriesId: series.id, field: 'capSizePx', value })
        }}
      />
      <p className="muted-note">
        不正な誤差値が1件でもある場合、この表示設定にかかわらず系列全体の誤差範囲を非表示にします。
      </p>
    </fieldset>
  )
}

function LegendControls({ project, onAction }: { project: ProjectState; onAction: (action: ProjectAction) => void }) {
  return (
    <fieldset>
      <legend>凡例</legend>
      <CheckboxControl
        label="凡例を表示"
        checked={project.chart.legend.visible}
        onChange={(value) => onAction({ type: 'set-legend-visible', value })}
      />
      <label className="control-label">
        <span>位置</span>
        <select
          value={project.chart.legend.position}
          onChange={(event) =>
            onAction({ type: 'set-legend-position', value: event.target.value as ProjectState['chart']['legend']['position'] })
          }
        >
          <option value="right">右</option>
          <option value="left">左</option>
          <option value="top">上</option>
          <option value="bottom">下</option>
        </select>
      </label>
    </fieldset>
  )
}

function TitleControls({ project, onAction }: { project: ProjectState; onAction: (action: ProjectAction) => void }) {
  const title = project.chart.title
  return (
    <>
      <fieldset>
        <legend>タイトル</legend>
        <CheckboxControl
          label="表示"
          checked={title.visible}
          onChange={(value) => onAction({ type: 'set-chart-title-visible', value })}
        />
        <label className="control-label">
          <span>文字列</span>
          <input
            type="text"
            value={title.text}
            onChange={(event) => onAction({ type: 'set-chart-title-text', value: event.target.value })}
          />
        </label>
      </fieldset>
      <FontControls
        legend="文字のオプション"
        style={title.style}
        bold={title.style.bold}
        onBold={(value) => onAction({ type: 'set-chart-title-style', field: 'bold', value })}
        onChange={(field, value) => onAction({ type: 'set-chart-title-style', field, value })}
      />
    </>
  )
}

function FontControls({
  legend,
  style,
  bold,
  onBold,
  onChange,
}: {
  legend: string
  style: FontStyleModel
  bold?: boolean
  onBold?: (value: boolean) => void
  onChange: (field: keyof FontStyleModel, value: string | number) => void
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <label className="control-label">
        <span>フォント</span>
        <select value={style.family} onChange={(event) => onChange('family', event.target.value)}>
          {FONT_FAMILIES.map((family) => <option value={family} key={family}>{family}</option>)}
        </select>
      </label>
      <NumberDraftInput
        label="文字サイズ"
        value={style.sizePx}
        minimum={STYLE_LIMITS.minFontSizePx}
        maximum={STYLE_LIMITS.maxFontSizePx}
        onCommit={(value) => {
          if (value !== null) onChange('sizePx', value)
        }}
      />
      <ColorControl label="色" value={style.color} onChange={(value) => onChange('color', value)} />
      {bold !== undefined && onBold && (
        <CheckboxControl label="太字" checked={bold} onChange={onBold} />
      )}
    </fieldset>
  )
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value.toUpperCase())
  const [editing, setEditing] = useState(false)
  const validDraft = /^#[0-9a-fA-F]{6}$/.test(draft)
  return (
    <label className="control-label">
      <span>{label}</span>
      <span className="color-control">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input
          className="color-hex-input"
          aria-label={`${label} HEX`}
          value={editing ? draft : value.toUpperCase()}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const nextDraft = event.target.value.toUpperCase()
            setDraft(nextDraft)
            setEditing(true)
            if (/^#[0-9A-F]{6}$/.test(nextDraft)) {
              onChange(nextDraft)
            }
          }}
          onFocus={() => {
            setDraft(value.toUpperCase())
            setEditing(true)
          }}
          onBlur={() => {
            if (!validDraft) setDraft(value.toUpperCase())
            setEditing(false)
          }}
        />
      </span>
    </label>
  )
}

function CheckboxControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function NumberDraftInput({
  label,
  value,
  allowAuto = false,
  minimum = -Number.MAX_VALUE,
  maximum = Number.MAX_VALUE,
  integer = false,
  onCommit,
}: {
  label: string
  value: number | null
  allowAuto?: boolean
  minimum?: number
  maximum?: number
  integer?: boolean
  onCommit: (value: number | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [invalid, setInvalid] = useState(false)
  const [editing, setEditing] = useState(false)

  const commit = () => {
    if (allowAuto && draft.trim() === '') {
      setInvalid(false)
      setEditing(false)
      onCommit(null)
      return
    }
    const parsed = Number(draft)
    const valid =
      draft.trim() !== '' &&
      Number.isFinite(parsed) &&
      parsed >= minimum &&
      parsed <= maximum &&
      (!integer || Number.isInteger(parsed))
    if (!valid) {
      setInvalid(true)
      setDraft(value === null ? '' : String(value))
      setEditing(false)
      return
    }
    setInvalid(false)
    setEditing(false)
    onCommit(parsed)
  }

  return (
    <label className="control-label">
      <span>{label}</span>
      <span className="number-draft-control">
        <input
          className={invalid ? 'input-invalid' : ''}
          inputMode="decimal"
          value={editing ? draft : value === null ? '' : String(value)}
          placeholder={allowAuto ? 'Auto' : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            setEditing(true)
            setInvalid(false)
          }}
          onFocus={() => {
            setDraft(value === null ? '' : String(value))
            setEditing(true)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setInvalid(false)
              setDraft(value === null ? '' : String(value))
              setEditing(false)
              event.currentTarget.blur()
            }
          }}
        />
        {allowAuto && (
          <button type="button" className="auto-button" onClick={() => { setDraft(''); setEditing(false); setInvalid(false); onCommit(null) }}>
            Auto
          </button>
        )}
      </span>
      {invalid && <small className="field-error">入力値を確認してください。</small>}
    </label>
  )
}
