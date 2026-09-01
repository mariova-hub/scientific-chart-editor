import { useRef } from 'react'

interface ToolbarProps {
  canSave: boolean
  canExport: boolean
  message: string | null
  messageKind: 'success' | 'error' | 'info'
  onSave: () => void
  onLoad: (file: File) => void
  onExportSvg: () => void
}

export function Toolbar({
  canSave,
  canExport,
  message,
  messageKind,
  onSave,
  onLoad,
  onExportSvg,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="toolbar" aria-label="プロジェクト操作">
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
      <button
        type="button"
        className="button button-secondary"
        disabled={!canExport}
        onClick={onExportSvg}
      >
        SVG出力
      </button>
      <div
        className={`toolbar-message message-${messageKind}`}
        role="status"
        aria-live="polite"
      >
        {message ?? '未保存の編集状態はブラウザ内だけに保持されます。'}
      </div>
    </div>
  )
}
