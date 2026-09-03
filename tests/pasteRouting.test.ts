import { describe, expect, it } from 'vitest'
import {
  handleGridPaste,
  isTextEditingTarget,
  shouldRoutePasteToGrid,
} from '../src/data/grid/pasteRouting'

function element(
  tagName: string,
  options: { contentEditable?: boolean; parentElement?: object | null } = {},
) {
  return {
    tagName,
    isContentEditable: options.contentEditable ?? false,
    parentElement: options.parentElement ?? null,
  }
}

function route(
  eventTarget: object,
  activeElement: object,
  options: { cellEditMode?: boolean; gridTargets?: object[] } = {},
) {
  const gridTargets = new Set(options.gridTargets ?? [eventTarget, activeElement])
  return shouldRoutePasteToGrid({
    eventTarget,
    activeElement,
    gridContains: (target) => gridTargets.has(target as object),
    cellEditMode: options.cellEditMode ?? false,
  })
}

function handle(
  eventTarget: object,
  activeElement: object,
  options: {
    cellEditMode?: boolean
    gridTargets?: object[]
    source?: string | null
  } = {},
) {
  let clipboardReads = 0
  let preventDefaultCalls = 0
  const pastedSources: string[] = []
  const gridTargets = new Set(
    options.gridTargets ?? [eventTarget, activeElement],
  )
  const handled = handleGridPaste({
    eventTarget,
    activeElement,
    gridContains: (target) => gridTargets.has(target as object),
    cellEditMode: options.cellEditMode ?? false,
    readPlainText: () => {
      clipboardReads += 1
      return options.source === undefined ? 'A\tB' : options.source
    },
    preventDefault: () => {
      preventDefaultCalls += 1
    },
    pasteRange: (source) => pastedSources.push(source),
  })
  return { handled, clipboardReads, preventDefaultCalls, pastedSources }
}

describe('paste routing', () => {
  it.each(['input', 'textarea', 'select'])('%sでは標準Pasteを優先する', (tagName) => {
    const target = element(tagName)
    expect(isTextEditingTarget(target)).toBe(true)
    expect(route(target, target)).toBe(false)
  })

  it('contenteditableとその子要素では標準Pasteを優先する', () => {
    const editor = element('div', { contentEditable: true })
    const child = element('span', { parentElement: editor })
    expect(isTextEditingTarget(child)).toBe(true)
    expect(route(child, child)).toBe(false)
  })

  it('Cell Edit ModeではGrid Pasteを実行しない', () => {
    const cell = element('td')
    expect(route(cell, cell, { cellEditMode: true })).toBe(false)
  })

  it('Data Grid cellにfocusがある場合だけGrid Pasteへrouteする', () => {
    const cell = element('td')
    expect(route(cell, cell)).toBe(true)
  })

  it('Active Cellが残っていても外部inputにfocusがあればGrid Pasteしない', () => {
    const cell = element('td')
    const axisTitleInput = element('input')
    expect(
      route(cell, axisTitleInput, {
        gridTargets: [cell],
      }),
    ).toBe(false)
  })

  it('focusがData Grid外へ移った場合はActive CellだけでGrid Pasteしない', () => {
    const cell = element('td')
    const outside = element('button')
    expect(route(cell, outside, { gridTargets: [cell] })).toBe(false)
  })

  it.each(['input', 'textarea'])(
    '%sではClipboardを読まず、preventDefaultせず、標準Pasteへ完全に委譲する',
    (tagName) => {
      const target = element(tagName)
      expect(handle(target, target)).toEqual({
        handled: false,
        clipboardReads: 0,
        preventDefaultCalls: 0,
        pastedSources: [],
      })
    },
  )

  it('contenteditableではClipboardを読まず標準Pasteへ完全に委譲する', () => {
    const editor = element('div', { contentEditable: true })
    const child = element('span', { parentElement: editor })
    expect(handle(child, child)).toEqual({
      handled: false,
      clipboardReads: 0,
      preventDefaultCalls: 0,
      pastedSources: [],
    })
  })

  it('Cell Edit ModeではClipboardを読まず標準Pasteへ完全に委譲する', () => {
    const editor = element('input')
    expect(handle(editor, editor, { cellEditMode: true })).toEqual({
      handled: false,
      clipboardReads: 0,
      preventDefaultCalls: 0,
      pastedSources: [],
    })
  })

  it('Active Cellが残っていてもinput focusならPaste eventへ副作用を与えない', () => {
    const cell = element('td')
    const axisTitleInput = element('input')
    expect(
      handle(cell, axisTitleInput, { gridTargets: [cell] }),
    ).toEqual({
      handled: false,
      clipboardReads: 0,
      preventDefaultCalls: 0,
      pastedSources: [],
    })
  })

  it('Grid cell routeでのみClipboardを読み、preventDefaultして矩形Pasteする', () => {
    const cell = element('td')
    expect(handle(cell, cell, { source: 'A\tB\n1\t2' })).toEqual({
      handled: true,
      clipboardReads: 1,
      preventDefaultCalls: 1,
      pastedSources: ['A\tB\n1\t2'],
    })
  })

  it('Grid routeでもplain textがなければpreventDefaultしない', () => {
    const cell = element('td')
    expect(handle(cell, cell, { source: null })).toEqual({
      handled: false,
      clipboardReads: 1,
      preventDefaultCalls: 0,
      pastedSources: [],
    })
  })
})
