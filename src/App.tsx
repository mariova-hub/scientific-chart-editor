import { useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import {
  ChartCanvas,
  type ChartCanvasHandle,
} from './components/ChartCanvas/ChartCanvas'
import { DataGrid } from './components/DataGrid/DataGrid'
import { FormatPane } from './components/FormatPane/FormatPane'
import { Toolbar } from './components/Toolbar/Toolbar'
import { parseTsv, TsvParseError } from './data/tsv/parseTsv'
import { resolveScatterSeries } from './model/dataBinding'
import { createEmptyProject } from './model/createProject'
import { DATA_LIMITS } from './model/limits'
import { validateProjectSemantics } from './model/projectValidation'
import { downloadTextFile } from './persistence/browserFiles'
import {
  loadProjectAtomically,
  ProjectSerializationError,
  serializeProjectFile,
} from './persistence/projectFile'
import { projectReducer } from './state/projectReducer'

type MessageKind = 'success' | 'error' | 'info'

function App() {
  const [project, dispatch] = useReducer(
    projectReducer,
    undefined,
    createEmptyProject,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<MessageKind>('info')
  const chartRef = useRef<ChartCanvasHandle>(null)
  const issues = useMemo(() => validateProjectSemantics(project), [project])
  const resolved = useMemo(
    () => resolveScatterSeries(project, project.chart.series[0]),
    [project],
  )
  const canPersist = issues.length === 0 && resolved.points.length > 0

  const showMessage = (text: string, kind: MessageKind) => {
    setMessage(text)
    setMessageKind(kind)
  }

  const handlePasteTable = (source: string) => {
    try {
      const dataset = parseTsv(source)
      dispatch({ type: 'replace-dataset', dataset })
      showMessage(
        `${dataset.columns.length}列・${dataset.rows.length}行を取り込みました。`,
        'success',
      )
    } catch (error) {
      showMessage(
        error instanceof TsvParseError
          ? error.message
          : '表データを読み取れませんでした。',
        'error',
      )
    }
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
        <span className="phase-badge">v0.1 · Phase 1</span>
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

      <main className="workspace-grid">
        <DataGrid
          project={project}
          onPasteTable={handlePasteTable}
          onSelectColumn={(role, columnId) =>
            dispatch({ type: 'set-binding', role, columnId })
          }
        />
        <ChartCanvas
          ref={chartRef}
          project={project}
          hasData={resolved.points.length > 0}
        />
        <FormatPane
          project={project}
          issues={issues}
          onAxisTitle={(dimension, title) =>
            dispatch({ type: 'set-axis-title', dimension, title })
          }
          onAxisBound={(dimension, bound, value) =>
            dispatch({ type: 'set-axis-bound', dimension, bound, value })
          }
          onMajorUnit={(dimension, value) =>
            dispatch({ type: 'set-axis-major-unit', dimension, value })
          }
          onChartTitle={(title) => dispatch({ type: 'set-chart-title', title })}
          onChartSize={(dimension, value) =>
            dispatch({ type: 'set-chart-size', dimension, value })
          }
        />
      </main>
    </div>
  )
}

export default App
