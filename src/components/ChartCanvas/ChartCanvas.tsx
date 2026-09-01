import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ProjectState } from '../../model/types'
import {
  exportPlotlySvg,
  purgePlotlyChart,
  renderPlotlyChart,
} from '../../renderer/plotly/plotlyRenderer'

export interface ChartCanvasHandle {
  exportSvg: () => Promise<void>
}

interface ChartCanvasProps {
  project: ProjectState
  hasData: boolean
}

export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(
  function ChartCanvas({ project, hasData }, ref) {
    const chartElementRef = useRef<HTMLDivElement>(null)
    const [renderError, setRenderError] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      exportSvg: async () => {
        if (!chartElementRef.current) throw new Error('グラフが未描画です。')
        await exportPlotlySvg(chartElementRef.current)
      },
    }))

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
            <h2 id="chart-heading">散布図</h2>
          </div>
          <span className="size-badge">
            {project.chart.size.widthPx} × {project.chart.size.heightPx}px
          </span>
        </div>
        <div className="chart-viewport">
          <div ref={chartElementRef} className="plotly-host" />
          {!hasData && (
            <div className="chart-empty">
              <strong>表を貼り付けてください</strong>
              <span>X列とY列を選ぶと散布図を生成します。</span>
            </div>
          )}
        </div>
        {renderError && <p className="message message-error">{renderError}</p>}
      </section>
    )
  },
)
