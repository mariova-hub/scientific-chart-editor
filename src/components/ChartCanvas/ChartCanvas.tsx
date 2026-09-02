import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ProjectState } from '../../model/types'
import type { ChartExportOptions } from '../../renderer/exportOptions'
import {
  calculateResizedChartSize,
  type ChartSize,
} from '../../model/resize'
import {
  exportPlotlyImage,
  purgePlotlyChart,
  renderPlotlyChart,
  resetPlotlyView,
} from '../../renderer/plotly/plotlyRenderer'

export interface ChartCanvasHandle {
  exportImage: (options: ChartExportOptions) => Promise<void>
}

interface ChartCanvasProps {
  project: ProjectState
  hasData: boolean
  selected: boolean
  onSelectChart: () => void
  onResizeComplete: (size: ChartSize) => void
}

export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(
  function ChartCanvas(
    { project, hasData, selected, onSelectChart, onResizeComplete },
    ref,
  ) {
    const chartElementRef = useRef<HTMLDivElement>(null)
    const [renderError, setRenderError] = useState<string | null>(null)
    const [previewSize, setPreviewSize] = useState<ChartSize>(project.chart.size)
    const dragRef = useRef<{
      pointerId: number
      startX: number
      startY: number
      startSize: ChartSize
    } | null>(null)

    const handleViewReset = useCallback(async () => {
      const element = chartElementRef.current
      if (!element) return
      try {
        await resetPlotlyView(element, project)
        setRenderError(null)
      } catch {
        setRenderError('グラフの表示をリセットできませんでした。')
      }
    }, [project])

    useEffect(() => {
      if (!dragRef.current) setPreviewSize(project.chart.size)
    }, [project.chart.size])

    useEffect(() => {
      const handlePointerMove = (event: PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        setPreviewSize(
          calculateResizedChartSize(
            drag.startSize,
            event.clientX - drag.startX,
            event.clientY - drag.startY,
          ),
        )
      }
      const handlePointerUp = (event: PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const size = calculateResizedChartSize(
          drag.startSize,
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        )
        dragRef.current = null
        setPreviewSize(size)
        onResizeComplete(size)
      }
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
      }
    }, [onResizeComplete])

    useImperativeHandle(ref, () => ({
      exportImage: async (options) => {
        if (!chartElementRef.current) throw new Error('グラフが未描画です。')
        await exportPlotlyImage(project, options)
      },
    }), [project])

    useEffect(() => {
      const element = chartElementRef.current
      if (!element) return
      let active = true

      renderPlotlyChart(element, project)
        .then(() => {
          if (active) setRenderError(null)
        })
        .catch(() => {
          if (active) setRenderError('グラフを描画できませんでした。設定を確認してください。')
        })

      return () => {
        active = false
        purgePlotlyChart(element)
      }
    }, [project])

    return (
      <section className="workspace-panel chart-panel" aria-labelledby="chart-heading">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Chart</span>
            <h2 id="chart-heading">
              {project.chart.type === 'bar'
                ? project.chart.bar.orientation === 'vertical'
                  ? '縦棒グラフ'
                  : '横棒グラフ'
                : '散布図'}
            </h2>
          </div>
          <span className="size-badge">
            {project.chart.size.widthPx} × {project.chart.size.heightPx}px
          </span>
        </div>
        <div className="chart-interaction-bar">
          <span className="chart-interaction-hint">
            ドラッグで拡大
            <span aria-hidden="true">｜</span>
            ダブルクリックで元に戻す
          </span>
          <button
            type="button"
            className="button button-secondary chart-reset-button"
            onClick={() => void handleViewReset()}
          >
            表示をリセット
          </button>
        </div>
        <div className="chart-viewport" onPointerDown={onSelectChart}>
          <div
            className={`chart-resize-frame${selected ? ' is-selected' : ''}`}
            style={{
              width: `${previewSize.widthPx}px`,
              height: `${previewSize.heightPx}px`,
            }}
          >
            <div ref={chartElementRef} className="plotly-host" />
            <button
              type="button"
              className="resize-handle"
              aria-label="グラフサイズをドラッグして変更"
              title="ドラッグしてサイズ変更"
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                dragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  startSize: project.chart.size,
                }
                setPreviewSize(project.chart.size)
              }}
            />
            {dragRef.current && (
              <span className="resize-preview-label" aria-live="polite">
                {previewSize.widthPx} × {previewSize.heightPx}px
              </span>
            )}
          </div>
          {!hasData && (
            <div className="chart-empty">
              <strong>表を貼り付けてください</strong>
              <span>
                {project.chart.type === 'bar'
                  ? project.chart.dataOrientation === 'rows'
                    ? 'カテゴリ範囲と値を選ぶと棒グラフを生成します。'
                    : 'カテゴリと値を選ぶと棒グラフを生成します。'
                  : 'X列とY列を選ぶと散布図を生成します。'}
              </span>
            </div>
          )}
        </div>
        {renderError && <p className="message message-error">{renderError}</p>}
      </section>
    )
  },
)
