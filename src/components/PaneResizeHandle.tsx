import { useEffect, useRef } from 'react'
import { calculateDataPaneWidth } from '../model/paneResize'

interface PaneResizeHandleProps {
  widthPx: number
  onWidthChange: (widthPx: number) => void
}

export function PaneResizeHandle({
  widthPx,
  onWidthChange,
}: PaneResizeHandleProps) {
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startWidthPx: number
  } | null>(null)

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      onWidthChange(
        calculateDataPaneWidth(
          drag.startWidthPx,
          event.clientX - drag.startX,
        ),
      )
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [onWidthChange])

  return (
    <div
      className="pane-resize-handle"
      role="separator"
      aria-label="データ領域の幅をドラッグして変更"
      aria-orientation="vertical"
      aria-valuemin={320}
      aria-valuemax={720}
      aria-valuenow={widthPx}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        onWidthChange(
          calculateDataPaneWidth(
            widthPx,
            event.key === 'ArrowLeft' ? -20 : 20,
          ),
        )
      }}
      onPointerDown={(event) => {
        event.preventDefault()
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidthPx: widthPx,
        }
      }}
    >
      <span aria-hidden="true" />
    </div>
  )
}
