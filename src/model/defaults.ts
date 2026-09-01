import type {
  AxisModel,
  BarRowBindings,
  ErrorBarModel,
  FontStyleModel,
  SeriesModel,
} from './types'

export const DEFAULT_FONT_FAMILY = 'Arial'

export function defaultAxisLine(): AxisModel['line'] {
  return { visible: true, color: '#4b5563', widthPx: 1 }
}

export function defaultAxisLabels(): FontStyleModel {
  return { family: DEFAULT_FONT_FAMILY, sizePx: 12, color: '#374151' }
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
