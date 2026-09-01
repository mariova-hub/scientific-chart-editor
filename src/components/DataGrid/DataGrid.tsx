import { useState } from 'react'
import {
  resolveBarSeries,
  resolveScatterSeries,
} from '../../model/dataBinding'
import type { ProjectState } from '../../model/types'

type BindingRole =
  | 'x'
  | 'y'
  | 'yError'
  | 'category'
  | 'value'
  | 'barError'

interface DataGridProps {
  project: ProjectState
  onPasteTable: (source: string) => void
  onSelectColumn: (role: BindingRole, columnId: string | null) => void
}

const MAX_VISIBLE_ROWS = 100

function displayCell(value: number | string | null): string {
  return value === null ? '—' : String(value)
}

export function DataGrid({
  project,
  onPasteTable,
  onSelectColumn,
}: DataGridProps) {
  const [source, setSource] = useState('')
  const dataset = project.datasets[0]
  const series = project.chart.series[0]
  const scatter =
    dataset && project.chart.type === 'scatter'
      ? resolveScatterSeries(project, series)
      : null
  const bar =
    dataset && project.chart.type === 'bar'
      ? resolveBarSeries(project, series)
      : null

  const applySource = (nextSource: string) => {
    setSource(nextSource)
    onPasteTable(nextSource)
  }

  const badgesByColumn = new Map<string, string[]>()
  const addBadge = (columnId: string | undefined, label: string) => {
    if (!columnId) return
    badgesByColumn.set(columnId, [
      ...(badgesByColumn.get(columnId) ?? []),
      label,
    ])
  }
  if (project.chart.type === 'bar') {
    addBadge(series.barBindings.category?.columnId, 'CATEGORY')
    addBadge(series.barBindings.value?.columnId, 'VALUE')
    addBadge(series.barBindings.error?.columnId, 'ERR')
  } else {
    addBadge(series.bindings.x?.columnId, 'X')
    addBadge(series.bindings.y?.columnId, 'Y')
    addBadge(series.errorBars.y.value?.source.columnId, 'ERR')
  }

  return (
    <section className="workspace-panel data-panel" aria-labelledby="data-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Data</span>
          <h2 id="data-heading">データの選択</h2>
        </div>
        {dataset && <span className="count-badge">{dataset.rows.length} rows</span>}
      </div>

      <label className="field-label" htmlFor="tsv-input">
        Sheets / ExcelからTSVを貼り付け
      </label>
      <textarea
        id="tsv-input"
        className="paste-area"
        value={source}
        placeholder={'試験管\t平均\tSD\n3\t1.24\t0.08'}
        onChange={(event) => setSource(event.target.value)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData('text/plain')
          if (pasted) {
            event.preventDefault()
            applySource(pasted)
          }
        }}
      />
      <button
        className="button button-secondary apply-button"
        type="button"
        disabled={source.trim() === ''}
        onClick={() => applySource(source)}
      >
        表を適用
      </button>

      {dataset && (
        <>
          <div className="binding-grid" aria-label="データ列の割り当て">
            {project.chart.type === 'bar' ? (
              <>
                <ColumnSelect
                  label="カテゴリ列"
                  value={series.barBindings.category?.columnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectColumn('category', columnId)}
                />
                <ColumnSelect
                  label="値の列"
                  value={series.barBindings.value?.columnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectColumn('value', columnId)}
                />
                <ColumnSelect
                  label="誤差の列"
                  value={series.barBindings.error?.columnId ?? ''}
                  columns={dataset.columns}
                  allowNone
                  onChange={(columnId) => onSelectColumn('barError', columnId)}
                />
              </>
            ) : (
              <>
                <ColumnSelect
                  label="X列"
                  value={series.bindings.x?.columnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectColumn('x', columnId)}
                />
                <ColumnSelect
                  label="Y列"
                  value={series.bindings.y?.columnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectColumn('y', columnId)}
                />
                <ColumnSelect
                  label="Y Error列"
                  value={series.errorBars.y.value?.source.columnId ?? ''}
                  columns={dataset.columns}
                  allowNone
                  onChange={(columnId) => onSelectColumn('yError', columnId)}
                />
              </>
            )}
          </div>

          <div className="data-summary" aria-live="polite">
            <strong>{bar ? `${bar.points.length} bars` : `${scatter?.points.length ?? 0} points`}</strong>
            <span>描画対象外: {bar?.skippedRowIds.length ?? scatter?.skippedXYRowIds.length ?? 0}</span>
            <span>誤差不正: {bar?.invalidErrorRowIds.length ?? scatter?.invalidErrorRowIds.length ?? 0}</span>
          </div>

          {((bar?.invalidErrorRowIds.length ?? 0) > 0 ||
            (scatter?.invalidErrorRowIds.length ?? 0) > 0) && (
            <div className="data-warning" role="alert">
              誤差の列に無効値（空、非数値、非有限値、負値）が
              {bar?.invalidErrorRowIds.length ?? scatter?.invalidErrorRowIds.length}
              件あります。この系列の誤差範囲全体を表示していません。
              {project.chart.type === 'bar' ? '棒' : '散布点'}と元データは維持されています。
            </div>
          )}

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {dataset.columns.map((column) => {
                    const badges = badgesByColumn.get(column.id) ?? []
                    return (
                      <th
                        scope="col"
                        key={column.id}
                        className={badges.length > 0 ? 'is-bound-column' : undefined}
                      >
                        <span className="column-heading-text">{column.name}</span>
                        {badges.length > 0 && (
                          <span className="binding-badges" aria-label={`割り当て: ${badges.join(', ')}`}>
                            {badges.map((badge) => (
                              <span className="binding-badge" key={badge}>{badge}</span>
                            ))}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(0, MAX_VISIBLE_ROWS).map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    {dataset.columns.map((column) => (
                      <td
                        key={column.id}
                        className={badgesByColumn.has(column.id) ? 'is-bound-column' : undefined}
                      >
                        {displayCell(row.cells[column.id] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dataset.rows.length > MAX_VISIBLE_ROWS && (
            <p className="muted-note">
              表示は先頭{MAX_VISIBLE_ROWS}行です。全データは保持されています。
            </p>
          )}
        </>
      )}
    </section>
  )
}

interface ColumnSelectProps {
  label: string
  value: string
  columns: { id: string; name: string }[]
  allowNone?: boolean
  onChange: (columnId: string | null) => void
}

function ColumnSelect({
  label,
  value,
  columns,
  allowNone = false,
  onChange,
}: ColumnSelectProps) {
  return (
    <label className="control-label">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
      >
        {allowNone && <option value="">なし</option>}
        {!allowNone && value === '' && <option value="">選択</option>}
        {columns.map((column) => (
          <option value={column.id} key={column.id}>
            {column.name}
          </option>
        ))}
      </select>
    </label>
  )
}
