import { describe, expect, it } from 'vitest'
import { resolveBarSeries } from '../src/model/dataBinding'
import { projectReducer } from '../src/state/projectReducer'
import { sampleBarProject } from './helpers'

describe('bar data binding', () => {
  it('accepts string categories and keeps row order', () => {
    const project = sampleBarProject(
      'カテゴリ\t値\t誤差\n試験管3\t1.2\t0.1\n試験管4\t1.5\t0.2',
    )
    const result = resolveBarSeries(project, project.chart.series[0])
    expect(result.points.map(({ category, value }) => [category, value])).toEqual([
      ['試験管3', 1.2],
      ['試験管4', 1.5],
    ])
  })

  it('accepts numeric categories', () => {
    const project = sampleBarProject()
    expect(
      resolveBarSeries(project, project.chart.series[0]).points.map(
        (point) => point.category,
      ),
    ).toEqual([3, 4, 5, 6, 7])
  })

  it('excludes invalid values without changing source rows', () => {
    const project = sampleBarProject(
      'カテゴリ\t値\t誤差\nA\t1\t0.1\nB\tbad\t0.2\nC\t\t0.3',
    )
    const before = structuredClone(project.datasets[0])
    const result = resolveBarSeries(project, project.chart.series[0])
    expect(result.points.map((point) => point.category)).toEqual(['A'])
    expect(result.skippedRowIds).toHaveLength(2)
    expect(project.datasets[0]).toEqual(before)
  })

  it('keeps error alignment after an invalid value row is removed', () => {
    const project = sampleBarProject(
      'カテゴリ\t値\t誤差\nA\t1\t0.1\nB\tbad\t0.2\nC\t3\t0.3',
    )
    expect(
      resolveBarSeries(project, project.chart.series[0]).points.map(
        ({ category, error }) => [category, error],
      ),
    ).toEqual([
      ['A', 0.1],
      ['C', 0.3],
    ])
  })

  it('accepts zero error and displays individual values', () => {
    const project = sampleBarProject(
      'カテゴリ\t値\t誤差\nA\t1\t0\nB\t2\t0.2',
    )
    const result = resolveBarSeries(project, project.chart.series[0])
    expect(result.points.map((point) => point.error)).toEqual([0, 0.2])
    expect(result.showErrorBars).toBe(true)
  })

  it.each([
    ['null', ''],
    ['string', 'bad'],
    ['negative', '-0.1'],
  ])('disables every error bar for a %s error', (_label, error) => {
    const project = sampleBarProject(
      `カテゴリ\t値\t誤差\nA\t1\t0.1\nB\t2\t${error}`,
    )
    const result = resolveBarSeries(project, project.chart.series[0])
    expect(result.points).toHaveLength(2)
    expect(result.invalidErrorRowIds).toHaveLength(1)
    expect(result.showErrorBars).toBe(false)
  })

  it('disables every error bar for a non-finite runtime value', () => {
    const project = sampleBarProject()
    const errorColumnId = project.chart.series[0].barBindings.error!.columnId
    project.datasets[0].rows[0].cells[errorColumnId] = Number.POSITIVE_INFINITY
    const result = resolveBarSeries(project, project.chart.series[0])
    expect(result.invalidErrorRowIds).toHaveLength(1)
    expect(result.showErrorBars).toBe(false)
  })

  it('preserves Category, Value, and Error bindings across orientation changes', () => {
    let project = sampleBarProject()
    const before = structuredClone(project.chart.series[0].barBindings)
    project = projectReducer(project, {
      type: 'set-bar-orientation',
      value: 'horizontal',
    })
    expect(project.chart.series[0].barBindings).toEqual(before)
  })
})
