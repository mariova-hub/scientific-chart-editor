import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
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
  serializeProjectRecoverySnapshot,
} from './persistence/projectFile'
import {
  ProjectAutosaveManager,
  type AutosaveStatus,
} from './persistence/autosave'
import { IndexedDbAutosaveStorage } from './persistence/indexedDbAutosave'
import { projectReducer, type ProjectAction } from './state/projectReducer'
import { prepareProjectAction } from './state/projectActionGuard'
import { defaultSelection } from './state/selection'
import {
  DEFAULT_CHART_EXPORT_OPTIONS,
  type ChartExportOptions,
} from './renderer/exportOptions'

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
  const [exportOptions, setExportOptions] = useState<ChartExportOptions>(
    DEFAULT_CHART_EXPORT_OPTIONS,
  )
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
    state: 'restoring',
  })
  const [autosaveReady, setAutosaveReady] = useState(false)
  const chartRef = useRef<ChartCanvasHandle>(null)
  const projectRef = useRef(project)
  const autosaveManagerRef = useRef<ProjectAutosaveManager | null>(null)
  const lastSavedSerializedRef = useRef<string | null>(null)
  const pendingImmediateSerializedRef = useRef<string | null>(null)
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

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    let active = true
    if (!window.indexedDB) {
      queueMicrotask(() => {
        if (!active) return
        setAutosaveStatus({
          state: 'error',
          message:
            '自動保存に失敗しました。プロジェクトファイルとして保存してください。',
        })
        lastSavedSerializedRef.current = null
        setAutosaveReady(true)
      })
      return () => {
        active = false
      }
    }

    const manager = new ProjectAutosaveManager(
      new IndexedDbAutosaveStorage(window.indexedDB),
      {
        onStatus: (status) => {
          if (active) setAutosaveStatus(status)
        },
        onSaved: (record) => {
          if (!active) return
          lastSavedSerializedRef.current = record.serializedProject
          if (
            pendingImmediateSerializedRef.current === record.serializedProject
          ) {
            pendingImmediateSerializedRef.current = null
          }
        },
      },
    )
    autosaveManagerRef.current = manager

    void manager.restore(projectRef.current).then((result) => {
      if (!active) return
      if (result.kind === 'restored') {
        lastSavedSerializedRef.current = result.record.serializedProject
        dispatch({ type: 'load-project', project: result.project })
        setSelection(defaultSelection(result.project))
        setMessage('前回の自動保存を復元しました。')
        setMessageKind('success')
      } else {
        lastSavedSerializedRef.current = null
        if (result.kind === 'invalid' || result.kind === 'storage-error') {
          setMessage(result.message)
          setMessageKind('error')
        }
      }
      setAutosaveReady(true)
    })

    return () => {
      active = false
      manager.dispose()
      if (autosaveManagerRef.current === manager) {
        autosaveManagerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!autosaveReady) return
    const manager = autosaveManagerRef.current
    if (!manager) return
    if (project.datasets.length !== 1) {
      manager.cancelPending()
      return
    }
    try {
      const serialized = serializeProjectRecoverySnapshot(project)
      if (
        serialized === lastSavedSerializedRef.current ||
        serialized === pendingImmediateSerializedRef.current
      ) {
        manager.cancelPending()
        return
      }
      manager.schedule(project)
    } catch {
      queueMicrotask(() => {
        setAutosaveStatus({
          state: 'error',
          message:
            '自動保存に失敗しました。プロジェクトファイルとして保存してください。',
        })
      })
    }
  }, [autosaveReady, project])

  const saveAutosaveNow = (nextProject: typeof project) => {
    const manager = autosaveManagerRef.current
    if (!manager) return
    try {
      const serialized = serializeProjectRecoverySnapshot(nextProject)
      pendingImmediateSerializedRef.current = serialized
      void manager.saveNow(nextProject).then((result) => {
        if (
          !result.ok &&
          pendingImmediateSerializedRef.current === serialized
        ) {
          pendingImmediateSerializedRef.current = null
        }
      })
    } catch {
      setAutosaveStatus({
        state: 'error',
        message:
          '自動保存に失敗しました。プロジェクトファイルとして保存してください。',
      })
    }
  }

  const clearAutosaveNow = () => {
    const manager = autosaveManagerRef.current
    lastSavedSerializedRef.current = null
    pendingImmediateSerializedRef.current = null
    if (!manager) return
    void manager.clearNow()
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

  const handleNew = () => {
    if (
      !window.confirm(
        '現在の作業内容を消去して新しいグラフを作成しますか？',
      )
    ) {
      return
    }
    const nextProject = createEmptyProject()
    dispatch({ type: 'load-project', project: nextProject })
    setSelection(defaultSelection(nextProject))
    clearAutosaveNow()
    showMessage('新しいグラフを作成しました。', 'success')
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
      saveAutosaveNow(loaded.project)
      showMessage('プロジェクトを検証して読み込みました。', 'success')
    } catch {
      showMessage('プロジェクトファイルを読み取れませんでした。', 'error')
    }
  }

  const handleExport = async () => {
    try {
      await chartRef.current?.exportImage(exportOptions)
      showMessage(`${exportOptions.format.toUpperCase()}を出力しました。`, 'success')
    } catch {
      showMessage(`${exportOptions.format.toUpperCase()}を出力できませんでした。`, 'error')
    }
  }

  if (!autosaveReady) {
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
          <span className="phase-badge">v0.1 · Phase 3D-4</span>
        </header>
        <section className="startup-restore" role="status" aria-live="polite">
          前回の作業を確認しています...
        </section>
      </div>
    )
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
        <span className="phase-badge">v0.1 · Phase 3D-4</span>
      </header>

      <Toolbar
        canSave={canPersist}
        canExport={canPersist}
        message={message}
        messageKind={messageKind}
        autosaveStatus={autosaveStatus}
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        exportOptions={exportOptions}
        onExportOptionsChange={setExportOptions}
        onExport={handleExport}
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
