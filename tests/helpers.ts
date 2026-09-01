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
