import type { ProjectState } from '../model/types'

export type ImageExportFormat = 'png' | 'svg'
export type PngExportScale = 1 | 2 | 3
export type ExportBackground = 'current' | 'transparent'

export interface ChartExportOptions {
  format: ImageExportFormat
  pngScale: PngExportScale
  background: ExportBackground
}

export interface PreparedImageExport {
  format: ImageExportFormat
  filename: 'scientific-chart'
  width: number
  height: number
  scale: number
  transparentBackground: boolean
}

export const DEFAULT_CHART_EXPORT_OPTIONS: ChartExportOptions = {
  format: 'png',
  pngScale: 1,
  background: 'current',
}

export function prepareImageExport(
  project: ProjectState,
  options: ChartExportOptions,
): PreparedImageExport {
  return {
    format: options.format,
    filename: 'scientific-chart',
    width: project.chart.size.widthPx,
    height: project.chart.size.heightPx,
    scale: options.format === 'png' ? options.pngScale : 1,
    transparentBackground:
      options.format === 'png' && options.background === 'transparent',
  }
}
