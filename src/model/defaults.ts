import type {
  AxisModel,
  BarRowBindings,
  ErrorBarModel,
  GridLineAppearanceModel,
  SeriesModel,
} from './types'

export const DEFAULT_FONT_FAMILY = 'Arial'

export function defaultAxisLine(): AxisModel['line'] {
  return { visible: true, color: '#4b5563', widthPx: 1 }
}

export function defaultAxisLabels(): AxisModel['labels'] {
  return {
    family: DEFAULT_FONT_FAMILY,
    sizePx: 12,
    color: '#374151',
    visible: true,
    bold: false,
    angleDeg: 0,
  }
}

export function defaultAxisTitleStyle() {
  return {
    family: DEFAULT_FONT_FAMILY,
    sizePx: 14,
    color: '#172033',
    bold: false,
  }
}

export function defaultAxisTickStyle() {
  return {
    majorLengthPx: 6,
    minorLengthPx: 3,
    lineWidthPx: 1,
  }
}

export function defaultMajorGridStyle(): GridLineAppearanceModel {
  return { color: '#d7dde7', widthPx: 1, style: 'solid' }
}

export function defaultMinorGridStyle(): GridLineAppearanceModel {
  return { color: '#e8ecf2', widthPx: 0.5, style: 'dot' }
}

export function defaultErrorBarStyle(): ErrorBarModel['style'] {
  return {
    visible: true,
    color: '#2563eb',
    widthPx: 1.5,
    capSizePx: 4,
  }
}

export function defaultMarkerStyle(): SeriesModel['style']['marker'] {
  return {
    visible: true,
    shape: 'circle',
    sizePx: 9,
    fillColor: '#2563eb',
    borderColor: '#1d4ed8',
    borderWidthPx: 1,
  }
}

export function defaultLineStyle(): SeriesModel['style']['line'] {
  return {
    visible: false,
    color: '#2563eb',
    widthPx: 2,
    dash: 'solid',
  }
}

export function defaultTitleStyle() {
  return {
    family: DEFAULT_FONT_FAMILY,
    sizePx: 20,
    color: '#172033',
    bold: false,
  }
}

export function defaultChartStyle() {
  return {
    backgroundColor: '#ffffff',
    plotBackgroundColor: '#ffffff',
  }
}

export function defaultPlotArea() {
  return {
    border: { visible: false, color: '#4b5563', widthPx: 1 },
    margin: {
      mode: 'auto' as const,
      topPx: 64,
      rightPx: 28,
      bottomPx: 70,
      leftPx: 78,
    },
  }
}

export function defaultBarStyle(): SeriesModel['style']['bar'] {
  return {
    fillColor: '#2563eb',
    borderColor: '#1d4ed8',
    borderWidthPx: 1,
    opacity: 1,
    widthRatio: 0.8,
  }
}

export function defaultBarOptions() {
  return {
    orientation: 'vertical' as const,
    gapRatio: 0.2,
  }
}

export function defaultBarRowBindings(): BarRowBindings {
  return {
    datasetId: null,
    categoryStartColumnId: null,
    categoryEndColumnId: null,
    valueRowId: null,
    errorRowId: null,
    labelColumnId: null,
  }
}
