import { useRef } from 'react'
import type { AutosaveStatus } from '../../persistence/autosave'
import type { ChartExportOptions } from '../../renderer/exportOptions'

interface ToolbarProps {
  canSave: boolean
  canExport: boolean
  message: string | null
  messageKind: 'success' | 'error' | 'info'
  autosaveStatus: AutosaveStatus
  onNew: () => void
  onSave: () => void
  onLoad: (file: File) => void
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
  onNew,
  onSave,
  onLoad,
  exportOptions,
  onExportOptionsChange,
  onExport,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autosaveText = (() => {
    if (autosaveStatus.state === 'restoring') return '前回の作業を確認中...'
    if (autosaveStatus.state === 'idle') return '自動保存待機中'
    if (autosaveStatus.state === 'saving') return '保存中...'
    if (autosaveStatus.state === 'error') return autosaveStatus.message
    const time = new Date(autosaveStatus.savedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `自動保存済み ${time}`
  })()

  return (
    <div className="toolbar" aria-label="プロジェクト操作">
      <button
        type="button"
        className="button button-secondary"
        onClick={onNew}
      >
        新規作成
      </button>
      <button
        type="button"
        className="button button-primary"
        disabled={!canSave}
        onClick={onSave}
      >
        プロジェクト保存
      </button>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => fileInputRef.current?.click()}
      >
        プロジェクト読込
      </button>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".scientific-chart.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onLoad(file)
          event.target.value = ''
        }}
      />
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
