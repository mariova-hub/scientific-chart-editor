import { describe, expect, it } from 'vitest'
import {
  cellEditSessionReducer,
  isDirectEditKey,
  isImeCompositionKey,
} from '../src/data/grid/editSession'

describe('cell edit session', () => {
  it('keeps the draft separate until commit and discards it on Escape', () => {
    let session = cellEditSessionReducer(null, {
      type: 'start',
      cell: { rowIndex: 2, columnIndex: 1 },
      draft: '1.51',
    })
    session = cellEditSessionReducer(session, { type: 'change', draft: '9.99' })
    expect(session?.draft).toBe('9.99')
    expect(cellEditSessionReducer(session, { type: 'cancel' })).toBeNull()
  })

  it('recognizes direct typing but leaves shortcuts to the grid', () => {
    expect(isDirectEditKey({ key: '2', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
    expect(isDirectEditKey({ key: 'あ', ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
    expect(isDirectEditKey({ key: 'v', ctrlKey: true, metaKey: false, altKey: false })).toBe(false)
  })

  it('does not treat an IME conversion Enter as edit commit', () => {
    expect(isImeCompositionKey({ isComposing: true }, false)).toBe(true)
    expect(isImeCompositionKey({ isComposing: false, keyCode: 229 }, false)).toBe(true)
    expect(isImeCompositionKey({ isComposing: false }, true)).toBe(true)
    expect(isImeCompositionKey({ isComposing: false }, false)).toBe(false)
  })
})
