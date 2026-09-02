import { useEffect, useRef } from 'react'
import type { AutosaveStatus } from '../../persistence/autosave'
import type {
  FileSystemAccessCapabilities,
  FormalSaveStatus,
} from '../../persistence/formalProjectFiles'
import { resolveProjectSaveShortcut } from '../../persistence/formalProjectFiles'
import type { ChartExportOptions } from '../../renderer/exportOptions'

interface ToolbarProps {
  canSave: boolean
  canExport: boolean
  message: string | null
  messageKind: 'success' | 'error' | 'info'
  autosaveStatus: AutosaveStatus
  formalSaveStatus: FormalSaveStatus
  currentFileName: string
  isDirty: boolean
  fileSystemAccess: FileSystemAccessCapabilities
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onFallbackLoad: (file: File) => void
  exportOptions: ChartExportOptions
  onExportOptionsChange: (options: ChartExportOptions) => void
  onExport: () => void
}

export function Toolbar({
  canSave,
  canExport,
  message,
  messageKind,
  autosaveStatus,
  formalSaveStatus,
  currentFileName,
  isDirty,
  fileSystemAccess,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onFallbackLoad,
  exportOptions,
  onExportOptionsChange,
  onExport,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autosaveText = (() => {
    if (autosaveStatus.state === 'restoring') return '前回の作業を確認中...'
    if (autosaveStatus.state === 'idle') return '自動保存待機中'
    if (autosaveStatus.state === 'saving') return '自動保存中...'
    if (autosaveStatus.state === 'error') return autosaveStatus.message
    const time = new Date(autosaveStatus.savedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `自動保存済み ${time}`
  })()
  const formalSaveText = (() => {
    if (formalSaveStatus.state === 'saving') return '保存中...'
    if (formalSaveStatus.state === 'opening') return '開いています...'
    if (formalSaveStatus.state === 'saved') return '保存しました'
    if (formalSaveStatus.state === 'opened') return '開きました'
    if (formalSaveStatus.state === 'error') return formalSaveStatus.message
    return isDirty ? '未保存の変更があります' : '正式保存の変更なし'
  })()
  const busy =
    formalSaveStatus.state === 'saving' ||
    formalSaveStatus.state === 'opening'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = resolveProjectSaveShortcut(event)
      if (!shortcut) return
      event.preventDefault()
      if (!canSave || busy) return
      if (shortcut === 'save-as') onSaveAs()
      else onSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, canSave, onSave, onSaveAs])

  return (
    <div className="toolbar" aria-label="プロジェクト操作">
      <button
        type="button"
        className="button button-secondary"
        disabled={busy}
        onClick={onNew}
      >
        新規
      </button>
      <button
        type="button"
        className="button button-secondary"
        disabled={busy}
        onClick={() =>
          fileSystemAccess.open
            ? onOpen()
            : fileInputRef.current?.click()
        }
      >
        開く
      </button>
      <button
        type="button"
        className="button button-primary"
        disabled={!canSave || busy}
        onClick={onSave}
      >
        保存
      </button>
      <button
        type="button"
        className="button button-secondary"
        disabled={!canSave || busy}
        onClick={onSaveAs}
      >
        名前を付けて保存
      </button>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".scientific-chart.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFallbackLoad(file)
          event.target.value = ''
        }}
      />
      <div className="current-file" aria-label="現在のファイル">
        <span className="current-file-label">ファイル</span>
        <strong title={currentFileName}>
          {currentFileName}
          {isDirty ? ' *' : ''}
        </strong>
        {!fileSystemAccess.save && (
          <small>このブラウザでは上書き保存に対応していません。</small>
        )}
      </div>
      <span className="toolbar-divider" />
      <section className="export-controls" aria-label="画像として保存">
        <span className="export-controls-title">画像として保存</span>
        <label>
          <span>形式</span>
          <select
            aria-label="出力形式"
            value={exportOptions.format}
            onChange={(event) =>
              onExportOptionsChange({
                ...exportOptions,
                format: event.target.value as ChartExportOptions['format'],
              })
            }
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
        </label>
        {exportOptions.format === 'png' && (
          <>
            <label>
              <span>PNG解像度</span>
              <select
                aria-label="PNG解像度"
                value={exportOptions.pngScale}
                onChange={(event) =>
                  onExportOptionsChange({
                    ...exportOptions,
                    pngScale: Number(event.target.value) as ChartExportOptions['pngScale'],
                  })
                }
              >
                <option value={1}>標準 (1×)</option>
                <option value={2}>2×</option>
                <option value={3}>3×</option>
              </select>
            </label>
            <label>
              <span>背景</span>
              <select
                aria-label="PNG背景"
                value={exportOptions.background}
                onChange={(event) =>
                  onExportOptionsChange({
                    ...exportOptions,
                    background: event.target.value as ChartExportOptions['background'],
                  })
                }
              >
                <option value="current">現在の背景</option>
                <option value="transparent">透明</option>
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          className="button button-secondary"
          disabled={!canExport}
          onClick={onExport}
        >
          {exportOptions.format.toUpperCase()}を保存
        </button>
      </section>
      <div className="toolbar-statuses">
        <div
          className={`formal-save-status formal-${formalSaveStatus.state}`}
          role="status"
          aria-live="polite"
        >
          {formalSaveText}
        </div>
        <div
          className={`autosave-status autosave-${autosaveStatus.state}`}
          role="status"
          aria-live="polite"
        >
          {autosaveText}
        </div>
        <div
          className={`toolbar-message message-${messageKind}`}
          role="status"
          aria-live="polite"
        >
          {message ?? '編集内容はこのブラウザへ自動保存されます。'}
        </div>
      </div>
    </div>
  )
}
