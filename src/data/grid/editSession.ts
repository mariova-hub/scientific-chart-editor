import type { ActiveCell } from './pasteRange'

export interface CellEditSession {
  cell: ActiveCell
  draft: string
}

export type CellEditSessionAction =
  | { type: 'start'; cell: ActiveCell; draft: string }
  | { type: 'change'; draft: string }
  | { type: 'finish' }
  | { type: 'cancel' }

export function cellEditSessionReducer(
  session: CellEditSession | null,
  action: CellEditSessionAction,
): CellEditSession | null {
  if (action.type === 'start') {
    return { cell: action.cell, draft: action.draft }
  }
  if (action.type === 'change') {
    return session ? { ...session, draft: action.draft } : session
  }
  return null
}

export function isImeCompositionKey(
  event: { isComposing: boolean; keyCode?: number },
  compositionActive: boolean,
): boolean {
  return compositionActive || event.isComposing || event.keyCode === 229
}

export function isDirectEditKey(event: {
  key: string
  keyCode?: number
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  return event.key.length === 1 || event.key === 'Process' || event.keyCode === 229
}
