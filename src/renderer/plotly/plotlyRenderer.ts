import Plotly from 'plotly.js-basic-dist-min'
import type { ProjectState } from '../../model/types'
import {
  prepareImageExport,
  type ChartExportOptions,
} from '../exportOptions'
import { toPlotlyFigure } from './plotlyAdapter'

export async function renderPlotlyChart(
  element: HTMLDivElement,
  project: ProjectState,
): Promise<void> {
  const figure = toPlotlyFigure(project)
  await Plotly.react(element, figure.data, figure.layout, figure.config)
}

export function purgePlotlyChart(element: HTMLDivElement): void {
  Plotly.purge(element)
}

export async function exportPlotlyImage(
  project: ProjectState,
  options: ChartExportOptions,
): Promise<void> {
  const request = prepareImageExport(project, options)
  const figure = toPlotlyFigure(project, {
    transparentBackground: request.transparentBackground,
  })
  const exportElement = document.createElement('div')
  exportElement.setAttribute('aria-hidden', 'true')
  Object.assign(exportElement.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${request.width}px`,
    height: `${request.height}px`,
    pointerEvents: 'none',
  })
  document.body.append(exportElement)

  try {
    await Plotly.react(
      exportElement,
      figure.data,
      figure.layout,
      figure.config,
    )
    const imageUrl = await Plotly.toImage(exportElement, {
      format: request.format,
      width: request.width,
      height: request.height,
      scale: request.scale,
    })
    const downloadLink = document.createElement('a')
    downloadLink.href = imageUrl
    downloadLink.download = `${request.filename}.${request.format}`
    downloadLink.click()
  } finally {
    Plotly.purge(exportElement)
    exportElement.remove()
  }
}
