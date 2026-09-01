import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  cellAddress,
  type ActiveCell,
} from '../../data/grid/pasteRange'
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
  onPasteRange: (start: ActiveCell, source: string) => void
  onSelectColumn: (role: BindingRole, columnId: string | null) => void
}

const MAX_VISIBLE_DATA_ROWS = 100
const MIN_VISIBLE_COLUMNS = 8
const MIN_VISIBLE_DATA_ROWS = 19

function displayCell(value: number | string | null): string {
  return value === null ? '' : String(value)
}

function columnLetter(columnIndex: number): string {
  return cellAddress({ rowIndex: 0, columnIndex }).replace(/\d+$/, '')
}

export function DataGrid({
  project,
  onPasteRange,
  onSelectColumn,
}: DataGridProps) {
  const [activeCell, setActiveCell] = useState<ActiveCell>({
    rowIndex: 0,
    columnIndex: 0,
  })
  const gridRef = useRef<HTMLDivElement>(null)
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
  const visibleColumnCount = Math.max(
    MIN_VISIBLE_COLUMNS,
    dataset?.columns.length ?? 0,
    activeCell.columnIndex + 1,
  )
  const visibleDataRowCount = Math.max(
    MIN_VISIBLE_DATA_ROWS,
    Math.min(dataset?.rows.length ?? 0, MAX_VISIBLE_DATA_ROWS),
    activeCell.rowIndex,
  )

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

  const focusCell = (cell: ActiveCell) => {
    setActiveCell(cell)
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(
          `[data-grid-row="${cell.rowIndex}"][data-grid-column="${cell.columnIndex}"]`,
        )
        ?.focus()
    })
  }

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    cell: ActiveCell,
  ) => {
    let next: ActiveCell | null = null
    if (event.key === 'ArrowLeft') {
      next = { ...cell, columnIndex: Math.max(0, cell.columnIndex - 1) }
    } else if (event.key === 'ArrowRight' || event.key === 'Tab') {
      next = {
        ...cell,
        columnIndex: Math.min(visibleColumnCount - 1, cell.columnIndex + 1),
      }
    } else if (event.key === 'ArrowUp') {
      next = { ...cell, rowIndex: Math.max(0, cell.rowIndex - 1) }
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      next = {
        ...cell,
        rowIndex: Math.min(visibleDataRowCount, cell.rowIndex + 1),
      }
    }
    if (!next) return
    event.preventDefault()
    focusCell(next)
  }

  const cellProps = (cell: ActiveCell) => ({
    'data-grid-row': cell.rowIndex,
    'data-grid-column': cell.columnIndex,
    tabIndex:
      activeCell.rowIndex === cell.rowIndex &&
      activeCell.columnIndex === cell.columnIndex
        ? 0
        : -1,
    className:
      activeCell.rowIndex === cell.rowIndex &&
      activeCell.columnIndex === cell.columnIndex
        ? 'is-active-cell'
        : undefined,
    onClick: (event: MouseEvent<HTMLElement>) => {
      setActiveCell(cell)
      event.currentTarget.focus()
    },
    onFocus: () => setActiveCell(cell),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      handleCellKeyDown(event, cell),
  })

  return (
    <section className="workspace-panel data-panel" aria-labelledby="data-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Data</span>
          <h2 id="data-heading">データの選択</h2>
        </div>
        {dataset && <span className="count-badge">{dataset.rows.length} rows</span>}
      </div>

      <div className="grid-paste-guide">
        <strong>アクティブセル: {cellAddress(activeCell)}</strong>
        <span>セルを選択してCtrl+V（Macは⌘V）で貼り付け</span>
      </div>

      <div
        className="table-scroll"
        ref={gridRef}
        onPaste={(event) => {
          if (!event.clipboardData.types.includes('text/plain')) return
          event.preventDefault()
          onPasteRange(activeCell, event.clipboardData.getData('text/plain'))
        }}
      >
        <table className="data-table" role="grid" aria-label="編集可能な表データ">
          <thead>
            <tr className="column-letter-row" aria-hidden="true">
              <th />
              {Array.from({ length: visibleColumnCount }, (_, columnIndex) => (
                <th key={`letter-${columnIndex}`}>{columnLetter(columnIndex)}</th>
              ))}
            </tr>
            <tr className="data-header-row">
              <th scope="row">1</th>
              {Array.from({ length: visibleColumnCount }, (_, columnIndex) => {
                const column = dataset?.columns[columnIndex]
                const badges = column
                  ? badgesByColumn.get(column.id) ?? []
                  : []
                const address = cellAddress({ rowIndex: 0, columnIndex })
                return (
                  <th
                    scope="col"
                    key={column?.id ?? `empty-header-${columnIndex}`}
                    {...cellProps({ rowIndex: 0, columnIndex })}
                    className={`${badges.length > 0 ? 'is-bound-column' : ''} ${
                      activeCell.rowIndex === 0 &&
                      activeCell.columnIndex === columnIndex
                        ? 'is-active-cell'
                        : ''
                    }`.trim() || undefined}
                    aria-label={`${address}: ${column?.name || '空の見出し'}`}
                  >
                    <span className="column-heading-text">{column?.name ?? ''}</span>
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
            {Array.from({ length: visibleDataRowCount }, (_, dataRowIndex) => {
              const row = dataset?.rows[dataRowIndex]
              const gridRowIndex = dataRowIndex + 1
              return (
                <tr key={row?.id ?? `empty-row-${dataRowIndex}`}>
                  <th scope="row">{gridRowIndex + 1}</th>
                  {Array.from({ length: visibleColumnCount }, (_, columnIndex) => {
                    const column = dataset?.columns[columnIndex]
                    const value =
                      row && column ? row.cells[column.id] ?? null : null
                    const address = cellAddress({
                      rowIndex: gridRowIndex,
                      columnIndex,
                    })
                    const bindingClass =
                      column && badgesByColumn.has(column.id)
                        ? 'is-bound-column'
                        : ''
                    const activeClass =
                      activeCell.rowIndex === gridRowIndex &&
                      activeCell.columnIndex === columnIndex
                        ? 'is-active-cell'
                        : ''
                    return (
                      <td
                        key={column?.id ?? `empty-${dataRowIndex}-${columnIndex}`}
                        {...cellProps({
                          rowIndex: gridRowIndex,
                          columnIndex,
                        })}
                        className={`${bindingClass} ${activeClass}`.trim() || undefined}
                        aria-label={`${address}: ${value === null ? '空' : String(value)}`}
                      >
                        {displayCell(value)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dataset && (
        <>
          {dataset.rows.length > MAX_VISIBLE_DATA_ROWS && (
            <p className="muted-note">
              表示は先頭{MAX_VISIBLE_DATA_ROWS}データ行です。全データは保持されています。
            </p>
          )}
          <div className="binding-grid" aria-label="データ列の割り当て">
            {project.chart.type === 'bar' ? (
              <>
                <ColumnSelect label="カテゴリ列" value={series.barBindings.category?.columnId ?? ''} columns={dataset.columns} onChange={(columnId) => onSelectColumn('category', columnId)} />
                <ColumnSelect label="値の列" value={series.barBindings.value?.columnId ?? ''} columns={dataset.columns} onChange={(columnId) => onSelectColumn('value', columnId)} />
                <ColumnSelect label="誤差の列" value={series.barBindings.error?.columnId ?? ''} columns={dataset.columns} allowNone onChange={(columnId) => onSelectColumn('barError', columnId)} />
              </>
            ) : (
              <>
                <ColumnSelect label="X列" value={series.bindings.x?.columnId ?? ''} columns={dataset.columns} onChange={(columnId) => onSelectColumn('x', columnId)} />
                <ColumnSelect label="Y列" value={series.bindings.y?.columnId ?? ''} columns={dataset.columns} onChange={(columnId) => onSelectColumn('y', columnId)} />
                <ColumnSelect label="Y Error列" value={series.errorBars.y.value?.source.columnId ?? ''} columns={dataset.columns} allowNone onChange={(columnId) => onSelectColumn('yError', columnId)} />
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
            {column.name || '（空の見出し）'}
          </option>
        ))}
      </select>
    </label>
  )
}
