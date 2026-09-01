import { useState } from 'react'
import { resolveScatterSeries } from '../../model/dataBinding'
import type { ProjectState } from '../../model/types'

interface DataGridProps {
  project: ProjectState
  onPasteTable: (source: string) => void
  onSelectColumn: (
    role: 'x' | 'y' | 'yError',
    columnId: string | null,
  ) => void
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
  const resolved = dataset ? resolveScatterSeries(project, series) : null

  const applySource = (nextSource: string) => {
    setSource(nextSource)
    onPasteTable(nextSource)
  }

  return (
    <section className="workspace-panel data-panel" aria-labelledby="data-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Data</span>
          <h2 id="data-heading">表データ</h2>
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
          </div>

          {resolved && (
            <div className="data-summary" aria-live="polite">
              <strong>{resolved.points.length} points</strong>
              <span>X/Y無効: {resolved.skippedXYRowIds.length}</span>
              <span>Y Error不正: {resolved.invalidErrorRowIds.length}</span>
            </div>
          )}

          {resolved &&
            series.errorBars.y.enabled &&
            resolved.invalidErrorRowIds.length > 0 && (
              <div className="data-warning" role="alert">
                Y Errorに無効値（空、非数値、非有限値、負値）が
                {resolved.invalidErrorRowIds.length}
                件あります。この系列のエラーバー全体を表示していません。散布点と元データは維持されています。
              </div>
            )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {dataset.columns.map((column) => (
                    <th scope="col" key={column.id}>
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(0, MAX_VISIBLE_ROWS).map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row">{index + 1}</th>
                    {dataset.columns.map((column) => (
                      <td key={column.id}>{displayCell(row.cells[column.id] ?? null)}</td>
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
