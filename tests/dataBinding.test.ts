import { describe, expect, it } from 'vitest'
import { resolveScatterSeries } from '../src/model/dataBinding'
import { sampleProject } from './helpers'

describe('data binding', () => {
  it('extracts X and Y values in row order', () => {
    const project = sampleProject()
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map(({ x, y }) => [x, y])).toEqual([
      [3, 1.24],
      [4, 1.51],
      [5, 1.83],
      [6, 2.1],
      [7, 2.31],
    ])
  })

  it('excludes rows with a nonnumeric X or Y without changing source data', () => {
    const project = sampleProject('X\tY\tE\n1\t2\t0.1\nbad\t3\t0.2\n4\tmissing\t0.3')
    const before = structuredClone(project.datasets[0])
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points).toHaveLength(1)
    expect(result.skippedXYRowIds).toHaveLength(2)
    expect(project.datasets[0]).toEqual(before)
  })

  it('maps an individual Y error value to each point', () => {
    const project = sampleProject()
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map((point) => point.yError)).toEqual([
      0.08, 0.12, 0.05, 0.14, 0.09,
    ])
    expect(result.showYErrorBars).toBe(true)
  })

  it('keeps invalid errors null and disables all error bars without changing data', () => {
    const project = sampleProject(
      'X\tY\tE\n1\t2\t\n2\t3\tbad\n3\t4\t-1\n4\t5\t0.5',
    )
    const errorColumnId = project.datasets[0].columns[2].id
    project.datasets[0].rows[3].cells[errorColumnId] = Number.POSITIVE_INFINITY
    const before = structuredClone(project.datasets[0])
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map((point) => point.yError)).toEqual([
      null,
      null,
      null,
      null,
    ])
    expect(result.invalidErrorRowIds).toHaveLength(4)
    expect(result.showYErrorBars).toBe(false)
    expect(project.datasets[0]).toEqual(before)
  })

  it('treats zero as a valid scientific error value', () => {
    const project = sampleProject('X\tY\tE\n1\t2\t0\n2\t3\t0.2')
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map((point) => point.yError)).toEqual([0, 0.2])
    expect(result.invalidErrorRowIds).toHaveLength(0)
    expect(result.showYErrorBars).toBe(true)
  })

  it('does not count an invalid error on a row excluded by invalid X/Y', () => {
    const project = sampleProject('X\tY\tE\nbad\t2\tbad\n2\t3\t0.2')
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map(({ x, y, yError }) => [x, y, yError])).toEqual([
      [2, 3, 0.2],
    ])
    expect(result.invalidErrorRowIds).toHaveLength(0)
    expect(result.showYErrorBars).toBe(true)
  })

  it('zips rows before filtering so an invalid Y row cannot shift error values', () => {
    const project = sampleProject('X\tY\tE\n1\t10\t0.1\n2\tbad\t0.2\n3\t30\t0.3')
    const result = resolveScatterSeries(project, project.chart.series[0])
    expect(result.points.map(({ x, y, yError }) => [x, y, yError])).toEqual([
      [1, 10, 0.1],
      [3, 30, 0.3],
    ])
  })
})
