import { useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import {
  ChartCanvas,
  type ChartCanvasHandle,
} from './components/ChartCanvas/ChartCanvas'
import { DataGrid } from './components/DataGrid/DataGrid'
import { FormatPane } from './components/FormatPane/FormatPane'
import { PaneResizeHandle } from './components/PaneResizeHandle'
import { Toolbar } from './components/Toolbar/Toolbar'
import { parseClipboardTsv } from './data/tsv/parseTsv'
import { applyCellEdit, clearGridCell } from './data/grid/editCell'
import {
  applyRectangularPaste,
  cellAddress,
  type ActiveCell,
} from './data/grid/pasteRange'
import { resolveBarSeries, resolveScatterSeries } from './model/dataBinding'
import { validateLogAxes } from './model/axisValidation'
import { createEmptyProject } from './model/createProject'
import { DATA_LIMITS } from './model/limits'
import {
  getProjectWarnings,
  validateProjectSemantics,
} from './model/projectValidation'
import { downloadTextFile } from './persistence/browserFiles'
import {
  loadProjectAtomically,
  ProjectSerializationError,
  serializeProjectFile,
} from './persistence/projectFile'
import { projectReducer, type ProjectAction } from './state/projectReducer'
import { prepareProjectAction } from './state/projectActionGuard'
import { defaultSelection } from './state/selection'

type MessageKind = 'success' | 'error' | 'info'

function App() {
  const [project, dispatch] = useReducer(
    projectReducer,
    undefined,
    createEmptyProject,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<MessageKind>('info')
  const [selection, setSelection] = useState(() => defaultSelection(project))
  const [dataPaneWidth, setDataPaneWidth] = useState(360)
  const chartRef = useRef<ChartCanvasHandle>(null)
  const issues = useMemo(() => validateProjectSemantics(project), [project])
  const resolvedCount = useMemo(
    () =>
      project.chart.type === 'bar'
        ? resolveBarSeries(project, project.chart.series[0]).points.length
        : resolveScatterSeries(project, project.chart.series[0]).points.length,
    [project],
  )
  const warnings = useMemo(() => getProjectWarnings(project), [project])
  const canPersist = issues.length === 0 && resolvedCount > 0

  const showMessage = (text: string, kind: MessageKind) => {
    setMessage(text)
    setMessageKind(kind)
  }

  const handleProjectAction = (action: ProjectAction) => {
    const prepared = prepareProjectAction(project, action)
    if (!prepared.ok) {
      showMessage(prepared.issue.message, 'error')
      return prepared.issue.message
    }
    dispatch(action)
    return null
  }

  const handlePasteRange = (start: ActiveCell, source: string) => {
    try {
      const values = parseClipboardTsv(source)
      const paste = applyRectangularPaste(project.datasets[0], {
        start,
        values,
      })
      if (!paste.ok) {
        showMessage(paste.message, 'error')
        return
      }
      const action = { type: 'paste-range', dataset: paste.dataset } as const
      const candidate = projectReducer(project, action)
      const logIssues = validateLogAxes(candidate)
      if (logIssues.length > 0) {
        showMessage(logIssues[0].message, 'error')
        return
      }
      dispatch(action)
      showMessage(
        `${cellAddress(start)}から${paste.pastedRows}行×${paste.pastedColumns}列を貼り付けました。`,
        'success',
      )
    } catch {
      showMessage('クリップボードの表データを貼り付けられませんでした。', 'error')
    }
  }

  const handleCellEdit = (cell: ActiveCell, draft: string) => {
    const result = applyCellEdit(project.datasets[0], cell, draft)
    if (!result.ok) {
      showMessage(result.message, 'error')
      return result.message
    }
    if (!result.changed) return null
    return handleProjectAction({ type: 'edit-cell', dataset: result.dataset })
  }

  const handleCellClear = (cell: ActiveCell) => {
    const result = clearGridCell(project.datasets[0], cell)
    if (!result.ok) {
      showMessage(result.message, 'error')
      return result.message
    }
    if (!result.changed) return null
    return handleProjectAction({ type: 'clear-cell', dataset: result.dataset })
  }

  const handleSave = () => {
    try {
      const json = serializeProjectFile(project)
      downloadTextFile(
        json,
        'sample.scientific-chart.json',
        'application/json',
      )
      showMessage('プロジェクトファイルを保存しました。', 'success')
    } catch (error) {
      showMessage(
        error instanceof ProjectSerializationError
          ? error.message
          : 'プロジェクトを保存できませんでした。',
        'error',
      )
    }
  }

  const handleLoad = async (file: File) => {
    if (file.size > DATA_LIMITS.maxProjectFileBytes) {
      showMessage('プロジェクトファイルは5 MiB以下にしてください。', 'error')
      return
    }
    try {
      const text = await file.text()
      const loaded = loadProjectAtomically(project, text)
      if (loaded.error) {
        showMessage(`${loaded.error.path}: ${loaded.error.message}`, 'error')
        return
      }
      dispatch({ type: 'load-project', project: loaded.project })
      setSelection(defaultSelection(loaded.project))
      showMessage('プロジェクトを検証して読み込みました。', 'success')
    } catch {
      showMessage('プロジェクトファイルを読み取れませんでした。', 'error')
    }
  }

  const handleExportSvg = async () => {
    try {
      await chartRef.current?.exportSvg()
      showMessage('SVGを出力しました。', 'success')
    } catch {
      showMessage('SVGを出力できませんでした。', 'error')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            SCE
          </div>
          <div>
            <p className="product-kicker">Scientific Chart Editor</p>
            <h1>Project workspace</h1>
          </div>
        </div>
        <span className="phase-badge">v0.1 · Phase 3B-4</span>
      </header>

      <Toolbar
        canSave={canPersist}
        canExport={canPersist}
        message={message}
        messageKind={messageKind}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportSvg={handleExportSvg}
      />

      <main
        className="workspace-grid"
        style={{ '--data-pane-width': `${dataPaneWidth}px` } as CSSProperties}
      >
        <DataGrid
          project={project}
          onPasteRange={handlePasteRange}
          onEditCell={handleCellEdit}
          onClearCell={handleCellClear}
          onSelectColumn={(role, columnId) =>
            handleProjectAction({ type: 'set-binding', role, columnId })
          }
          onDataOrientationChange={(value) =>
            handleProjectAction({ type: 'set-data-orientation', value })
          }
          onSelectRowCategoryBound={(bound, columnId) =>
            handleProjectAction({
              type: 'set-row-category-bound',
              bound,
              columnId,
            })
          }
          onSelectRowBinding={(role, rowId) =>
            handleProjectAction({ type: 'set-row-binding', role, rowId })
          }
          onSelectRowLabelColumn={(columnId) =>
            handleProjectAction({ type: 'set-row-label-column', columnId })
          }
        />
        <PaneResizeHandle
          widthPx={dataPaneWidth}
          onWidthChange={setDataPaneWidth}
        />
        <ChartCanvas
          ref={chartRef}
          project={project}
          hasData={resolvedCount > 0}
          selected={selection.type === 'chart'}
          onSelectChart={() => setSelection(defaultSelection(project))}
          onResizeComplete={(size) =>
            handleProjectAction({
              type: 'set-chart-size-complete',
              widthPx: size.widthPx,
              heightPx: size.heightPx,
            })
          }
        />
        <FormatPane
          project={project}
          selection={selection}
          issues={issues}
          warnings={warnings}
          onSelectionChange={setSelection}
          onAction={handleProjectAction}
        />
      </main>
    </div>
  )
}

export default App
