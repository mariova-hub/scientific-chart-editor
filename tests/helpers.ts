import { parseTsv } from '../src/data/tsv/parseTsv'
import {
  createEmptyProject,
  projectWithDataset,
  type IdFactory,
} from '../src/model/createProject'
import type { ProjectState } from '../src/model/types'
import { projectReducer } from '../src/state/projectReducer'

export function sequentialIds(prefix = 'id'): IdFactory {
  let index = 0
  return () => `${prefix}-${++index}`
}

export function sampleProject(
  tsv = '試験管\t平均\tSD\n3\t1.24\t0.08\n4\t1.51\t0.12\n5\t1.83\t0.05\n6\t2.10\t0.14\n7\t2.31\t0.09',
): ProjectState {
  const ids = sequentialIds()
  const initial = createEmptyProject(ids, '2026-09-01T00:00:00.000Z')
  const dataset = parseTsv(tsv, ids)
  let project = projectWithDataset(
    initial,
    dataset,
    '2026-09-01T00:00:00.000Z',
  )
  project = projectReducer(project, {
    type: 'set-binding',
    role: 'yError',
    columnId: dataset.columns[2]?.id ?? null,
  })
  return project
}

export function sampleBarProject(
  tsv = '試験管\t平均\tSD\n3\t1.24\t0.08\n4\t1.51\t0.12\n5\t1.83\t0.05\n6\t2.10\t0.14\n7\t2.31\t0.09',
): ProjectState {
  let project = sampleProject(tsv)
  project = projectReducer(project, { type: 'set-chart-type', value: 'bar' })
  return project
}

export function sampleRowBarProject(
  tsv = '項目\t試験管3\t試験管4\t試験管5\t試験管6\t試験管7\n平均\t1.24\t1.51\t1.83\t2.10\t2.31\nSD\t0.08\t0.12\t0.05\t0.14\t0.09',
): ProjectState {
  const ids = sequentialIds('row')
  const initial = createEmptyProject(ids, '2026-09-01T00:00:00.000Z')
  const dataset = parseTsv(tsv, ids)
  let project = projectWithDataset(
    initial,
    dataset,
    '2026-09-01T00:00:00.000Z',
  )
  project = projectReducer(project, { type: 'set-chart-type', value: 'bar' })
  project = projectReducer(project, {
    type: 'set-data-orientation',
    value: 'rows',
  })
  project = projectReducer(project, {
    type: 'set-row-category-bound',
    bound: 'start',
    columnId: dataset.columns[1]?.id ?? null,
  })
  project = projectReducer(project, {
    type: 'set-row-category-bound',
    bound: 'end',
    columnId:
      dataset.columns[Math.min(5, dataset.columns.length - 1)]?.id ?? null,
  })
  project = projectReducer(project, {
    type: 'set-row-binding',
    role: 'value',
    rowId: dataset.rows[0]?.id ?? null,
  })
  project = projectReducer(project, {
    type: 'set-row-binding',
    role: 'error',
    rowId: dataset.rows[1]?.id ?? null,
  })
  return project
}
