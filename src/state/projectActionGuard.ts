import {
  validateAxisSettings,
  validateLogAxes,
} from '../model/axisValidation'
import type { ProjectState, ValidationIssue } from '../model/types'
import { projectReducer, type ProjectAction } from './projectReducer'

export type PreparedProjectAction =
  | { ok: true; candidate: ProjectState }
  | { ok: false; issue: ValidationIssue }

export function prepareProjectAction(
  project: ProjectState,
  action: ProjectAction,
): PreparedProjectAction {
  const candidate = projectReducer(project, action)
  const issue =
    validateAxisSettings(candidate)[0] ?? validateLogAxes(candidate)[0]

  return issue ? { ok: false, issue } : { ok: true, candidate }
}
