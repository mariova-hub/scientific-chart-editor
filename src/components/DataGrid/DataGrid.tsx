import {
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { readGridCellText } from '../../data/grid/editCell'
import {
  cellEditSessionReducer,
  isDirectEditKey,
  isImeCompositionKey,
} from '../../data/grid/editSession'
import {
  cellAddress,
  type ActiveCell,
} from '../../data/grid/pasteRange'
import {
  formatDataRowLabel,
  resolveBarSeries,
  resolveScatterSeries,
} from '../../model/dataBinding'
import type { DataOrientation, ProjectState } from '../../model/types'

type BindingRole =
  | 'x'
  | 'y'
  | 'yError'
  | 'category'
  | 'value'
  | 'barError'
type RowBindingRole = 'value' | 'error'

interface DataGridProps {
  project: ProjectState
  onPasteRange: (start: ActiveCell, source: string) => void
  onEditCell: (cell: ActiveCell, draft: string) => string | null
  onClearCell: (cell: ActiveCell) => string | null
  onSelectColumn: (role: BindingRole, columnId: string | null) => void
  onDataOrientationChange: (value: DataOrientation) => void
  onSelectRowCategoryBound: (
    bound: 'start' | 'end',
    columnId: string | null,
  ) => void
  onSelectRowBinding: (role: RowBindingRole, rowId: string | null) => void
  onSelectRowLabelColumn: (columnId: string | null) => void
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

function sameCell(left: ActiveCell, right: ActiveCell): boolean {
  return (
    left.rowIndex === right.rowIndex &&
    left.columnIndex === right.columnIndex
  )
}

export function DataGrid({
  project,
  onPasteRange,
  onEditCell,
  onClearCell,
  onSelectColumn,
  onDataOrientationChange,
  onSelectRowCategoryBound,
  onSelectRowBinding,
  onSelectRowLabelColumn,
}: DataGridProps) {
  const [activeCell, setActiveCell] = useState<ActiveCell>({
    rowIndex: 0,
    columnIndex: 0,
  })
  const [editSession, editDispatch] = useReducer(cellEditSessionReducer, null)
  const [editError, setEditError] = useState<string | null>(null)
  const compositionActive = useRef(false)
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
  const badgesByRow = new Map<string, string[]>()
  const addBadge = (columnId: string | undefined, label: string) => {
    if (!columnId) return
    badgesByColumn.set(columnId, [
      ...(badgesByColumn.get(columnId) ?? []),
      label,
    ])
  }
  const addRowBadge = (rowId: string | undefined | null, label: string) => {
    if (!rowId) return
    badgesByRow.set(rowId, [...(badgesByRow.get(rowId) ?? []), label])
  }
  if (project.chart.type === 'bar') {
    if (project.chart.dataOrientation === 'rows' && dataset) {
      const rowBindings = series.barRowBindings
      const startIndex = dataset.columns.findIndex(
        (column) => column.id === rowBindings.categoryStartColumnId,
      )
      const endIndex = dataset.columns.findIndex(
        (column) => column.id === rowBindings.categoryEndColumnId,
      )
      if (startIndex >= 0 && endIndex >= startIndex) {
        dataset.columns
          .slice(startIndex, endIndex + 1)
          .forEach((column) => addBadge(column.id, 'CATEGORY'))
      }
      addRowBadge(rowBindings.valueRowId, 'VALUE')
      addRowBadge(rowBindings.errorRowId, 'ERR')
    } else {
      addBadge(series.barBindings.category?.columnId, 'CATEGORY')
      addBadge(series.barBindings.value?.columnId, 'VALUE')
      addBadge(series.barBindings.error?.columnId, 'ERR')
    }
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

  const focusEditor = (cell: ActiveCell, placeAtEnd = true) => {
    const focus = () => {
      const editor = gridRef.current?.querySelector<HTMLInputElement>(
        `[data-cell-editor-row="${cell.rowIndex}"][data-cell-editor-column="${cell.columnIndex}"]`,
      )
      editor?.focus()
      if (placeAtEnd && editor) {
        editor.setSelectionRange(editor.value.length, editor.value.length)
      }
      return Boolean(editor)
    }
    if (!focus()) requestAnimationFrame(focus)
  }

  const startEditing = (
    cell: ActiveCell,
    initialDraft = readGridCellText(dataset, cell),
  ) => {
    compositionActive.current = false
    // IME composition must see a focused text input during the initiating
    // keyboard event, so commit the editor synchronously before it continues.
    flushSync(() => {
      setActiveCell(cell)
      setEditError(null)
      editDispatch({ type: 'start', cell, draft: initialDraft })
    })
    focusEditor(cell)
  }

  const cancelEditing = () => {
    const cell = editSession?.cell
    compositionActive.current = false
    setEditError(null)
    editDispatch({ type: 'cancel' })
    if (cell) focusCell(cell)
  }

  const moveCell = (
    cell: ActiveCell,
    rowDelta: number,
    columnDelta: number,
  ): ActiveCell => ({
    rowIndex: Math.min(
      visibleDataRowCount,
      Math.max(0, cell.rowIndex + rowDelta),
    ),
    columnIndex: Math.min(
      visibleColumnCount - 1,
      Math.max(0, cell.columnIndex + columnDelta),
    ),
  })

  const finishEditing = (nextCell?: ActiveCell, restoreFocus = true) => {
    if (!editSession) return
    const error = onEditCell(editSession.cell, editSession.draft)
    if (error) {
      setEditError(error)
      focusEditor(editSession.cell, false)
      return
    }
    compositionActive.current = false
    setEditError(null)
    editDispatch({ type: 'finish' })
    if (nextCell) focusCell(nextCell)
    else if (restoreFocus) focusCell(editSession.cell)
  }

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    cell: ActiveCell,
  ) => {
    if (editSession) return

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onClearCell(cell)
      return
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      startEditing(cell)
      return
    }
    if (
      isDirectEditKey({
        key: event.key,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      })
    ) {
      if (event.key.length === 1) event.preventDefault()
      startEditing(cell, event.key.length === 1 ? event.key : '')
      return
    }

    let next: ActiveCell | null = null
    if (event.key === 'ArrowLeft') {
      next = moveCell(cell, 0, -1)
    } else if (event.key === 'ArrowRight') {
      next = moveCell(cell, 0, 1)
    } else if (event.key === 'Tab') {
      next = moveCell(cell, 0, event.shiftKey ? -1 : 1)
    } else if (event.key === 'ArrowUp') {
      next = moveCell(cell, -1, 0)
    } else if (event.key === 'ArrowDown') {
      next = moveCell(cell, 1, 0)
    }
    if (!next) return
    event.preventDefault()
    focusCell(next)
  }

  const cellProps = (cell: ActiveCell) => ({
    'data-grid-row': cell.rowIndex,
    'data-grid-column': cell.columnIndex,
    tabIndex: sameCell(activeCell, cell) ? 0 : -1,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('input')) return
      setActiveCell(cell)
      event.currentTarget.focus()
    },
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault()
      startEditing(cell)
    },
    onFocus: () => setActiveCell(cell),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      handleCellKeyDown(event, cell),
  })

  const editorFor = (cell: ActiveCell) => {
    if (!editSession || !sameCell(editSession.cell, cell)) return null
    const address = cellAddress(cell)
    return (
      <input
        className="cell-editor"
        data-cell-editor-row={cell.rowIndex}
        data-cell-editor-column={cell.columnIndex}
        aria-label={`${address}を編集中`}
        aria-invalid={editError ? true : undefined}
        value={editSession.draft}
        onChange={(event) =>
          editDispatch({ type: 'change', draft: event.target.value })
        }
        onCompositionStart={() => {
          compositionActive.current = true
        }}
        onCompositionEnd={() => {
          compositionActive.current = false
        }}
        onPaste={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (
            isImeCompositionKey(
              {
                isComposing: event.nativeEvent.isComposing,
                keyCode: event.keyCode,
              },
              compositionActive.current,
            )
          ) {
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelEditing()
          } else if (event.key === 'Enter') {
            event.preventDefault()
            finishEditing(
              moveCell(cell, event.shiftKey ? -1 : 1, 0),
            )
          } else if (event.key === 'Tab') {
            event.preventDefault()
            finishEditing(
              moveCell(cell, 0, event.shiftKey ? -1 : 1),
            )
          }
        }}
        onBlur={() => finishEditing(undefined, false)}
      />
    )
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

      <div className="grid-paste-guide">
        <strong>
          {editSession ? '編集中' : 'アクティブセル'}:{' '}
          {cellAddress(editSession?.cell ?? activeCell)}
        </strong>
        <span>直接入力・Delete / Backspace・Ctrl+V（Macは⌘V）</span>
      </div>

      <div
        className="table-scroll"
        ref={gridRef}
        onPaste={(event) => {
          if (editSession) return
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
                const cell = { rowIndex: 0, columnIndex }
                const address = cellAddress(cell)
                const editing = Boolean(editSession && sameCell(editSession.cell, cell))
                return (
                  <th
                    scope="col"
                    key={column?.id ?? `empty-header-${columnIndex}`}
                    {...cellProps(cell)}
                    className={`${badges.length > 0 ? 'is-bound-column' : ''} ${
                      sameCell(activeCell, cell) ? 'is-active-cell' : ''
                    } ${editing ? 'is-editing-cell' : ''}`.trim() || undefined}
                    aria-label={`${address}: ${column?.name || '空の見出し'}`}
                  >
                    {editing ? (
                      editorFor(cell)
                    ) : (
                      <>
                        <span className="column-heading-text">{column?.name ?? ''}</span>
                        {badges.length > 0 && (
                          <span
                            className="binding-badges"
                            aria-label={`割り当て: ${badges.join(', ')}`}
                          >
                            {badges.map((badge) => (
                              <span className="binding-badge" key={badge}>
                                {badge}
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    )}
                    {editing && editError && (
                      <span className="cell-edit-error">{editError}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: visibleDataRowCount }, (_, dataRowIndex) => {
              const row = dataset?.rows[dataRowIndex]
              const rowBadges = row ? badgesByRow.get(row.id) ?? [] : []
              const gridRowIndex = dataRowIndex + 1
              return (
                <tr key={row?.id ?? `empty-row-${dataRowIndex}`}>
                  <th
                    scope="row"
                    className={rowBadges.length > 0 ? 'is-bound-row' : undefined}
                  >
                    <span className="row-number">{gridRowIndex + 1}</span>
                    {rowBadges.length > 0 && (
                      <span className="binding-badges" aria-label={`行の割り当て: ${rowBadges.join(', ')}`}>
                        {rowBadges.map((badge) => (
                          <span className="binding-badge" key={badge}>{badge}</span>
                        ))}
                      </span>
                    )}
                  </th>
                  {Array.from({ length: visibleColumnCount }, (_, columnIndex) => {
                    const column = dataset?.columns[columnIndex]
                    const value =
                      row && column ? row.cells[column.id] ?? null : null
                    const cell = { rowIndex: gridRowIndex, columnIndex }
                    const address = cellAddress(cell)
                    const bindingClass = [
                      column && badgesByColumn.has(column.id)
                        ? 'is-bound-column'
                        : '',
                      rowBadges.length > 0 ? 'is-bound-row' : '',
                    ].filter(Boolean).join(' ')
                    const editing = Boolean(editSession && sameCell(editSession.cell, cell))
                    return (
                      <td
                        key={column?.id ?? `empty-${dataRowIndex}-${columnIndex}`}
                        {...cellProps(cell)}
                        className={`${bindingClass} ${
                          sameCell(activeCell, cell) ? 'is-active-cell' : ''
                        } ${editing ? 'is-editing-cell' : ''}`.trim() || undefined}
                        aria-label={`${address}: ${value === null ? '空' : String(value)}`}
                      >
                        {editing ? editorFor(cell) : displayCell(value)}
                        {editing && editError && (
                          <span className="cell-edit-error">{editError}</span>
                        )}
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
          <fieldset className="data-orientation-fieldset">
            <legend>データ系列の方向</legend>
            <div className="orientation-control" role="radiogroup" aria-label="データ系列の方向">
              <label>
                <input
                  type="radio"
                  name="data-orientation"
                  value="columns"
                  checked={project.chart.dataOrientation === 'columns'}
                  onChange={() => onDataOrientationChange('columns')}
                />
                列
              </label>
              <label>
                <input
                  type="radio"
                  name="data-orientation"
                  value="rows"
                  checked={project.chart.dataOrientation === 'rows'}
                  disabled={project.chart.type !== 'bar'}
                  onChange={() => onDataOrientationChange('rows')}
                />
                行
              </label>
            </div>
            <p className="muted-note">
              {project.chart.type === 'bar'
                ? '表は転置せず、グラフがデータを列方向または行方向に読みます。'
                : '行方向は現在、棒グラフで利用できます。'}
            </p>
          </fieldset>
          <div className="binding-grid" aria-label="データ列の割り当て">
            {project.chart.type === 'bar' && project.chart.dataOrientation === 'rows' ? (
              <>
                <ColumnSelect
                  label="カテゴリ開始列"
                  value={series.barRowBindings.categoryStartColumnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectRowCategoryBound('start', columnId)}
                />
                <ColumnSelect
                  label="カテゴリ終了列"
                  value={series.barRowBindings.categoryEndColumnId ?? ''}
                  columns={dataset.columns}
                  onChange={(columnId) => onSelectRowCategoryBound('end', columnId)}
                />
                <ColumnSelect
                  label="行ラベル列"
                  value={series.barRowBindings.labelColumnId ?? ''}
                  columns={dataset.columns}
                  allowNone
                  onChange={onSelectRowLabelColumn}
                />
                <RowSelect
                  label="値の行"
                  value={series.barRowBindings.valueRowId ?? ''}
                  dataset={dataset}
                  labelColumnId={series.barRowBindings.labelColumnId}
                  onChange={(rowId) => onSelectRowBinding('value', rowId)}
                />
                <RowSelect
                  label="誤差の行"
                  value={series.barRowBindings.errorRowId ?? ''}
                  dataset={dataset}
                  labelColumnId={series.barRowBindings.labelColumnId}
                  allowNone
                  onChange={(rowId) => onSelectRowBinding('error', rowId)}
                />
              </>
            ) : project.chart.type === 'bar' ? (
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
              誤差の{project.chart.type === 'bar' && project.chart.dataOrientation === 'rows' ? '行' : '列'}に無効値（空、非数値、非有限値、負値）が
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

interface RowSelectProps {
  label: string
  value: string
  dataset: ProjectState['datasets'][number]
  labelColumnId: string | null
  allowNone?: boolean
  onChange: (rowId: string | null) => void
}

function RowSelect({
  label,
  value,
  dataset,
  labelColumnId,
  allowNone = false,
  onChange,
}: RowSelectProps) {
  return (
    <label className="control-label">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
      >
        {allowNone && <option value="">なし</option>}
        {!allowNone && value === '' && <option value="">選択</option>}
        {dataset.rows.map((row, index) => (
          <option value={row.id} key={row.id}>
            {formatDataRowLabel(dataset, row, index, labelColumnId)}
          </option>
        ))}
      </select>
    </label>
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
        {columns.map((column, index) => (
          <option value={column.id} key={column.id}>
            {column.name || `${columnLetter(index)}列（見出しなし）`}
          </option>
        ))}
      </select>
    </label>
  )
}
