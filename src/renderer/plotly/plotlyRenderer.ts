import Plotly from 'plotly.js-basic-dist-min'
import type { ProjectState } from '../../model/types'
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

export async function exportPlotlySvg(
  element: HTMLDivElement,
): Promise<void> {
  await Plotly.downloadImage(element, {
    format: 'svg',
    filename: 'scientific-chart',
    width: element.clientWidth,
    height: element.clientHeight,
  })
}
