interface ElementLike {
  tagName?: unknown
  isContentEditable?: unknown
  parentElement?: ElementLike | null
}

interface PasteRoutingContext {
  eventTarget: unknown
  activeElement: unknown
  gridContains: (target: unknown) => boolean
  cellEditMode: boolean
}

interface GridPasteHandlingContext extends PasteRoutingContext {
  readPlainText: () => string | null
  preventDefault: () => void
  pasteRange: (source: string) => void
}

interface GridCopyHandlingContext extends PasteRoutingContext {
  source: string
  writePlainText: (source: string) => void
  preventDefault: () => void
}

const NATIVE_PASTE_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function asElementLike(target: unknown): ElementLike | null {
  return target !== null && typeof target === 'object'
    ? (target as ElementLike)
    : null
}

export function isTextEditingTarget(target: unknown): boolean {
  let current = asElementLike(target)
  while (current) {
    const tagName =
      typeof current.tagName === 'string'
        ? current.tagName.toUpperCase()
        : ''
    if (
      NATIVE_PASTE_TARGETS.has(tagName) ||
      current.isContentEditable === true
    ) {
      return true
    }
    current = current.parentElement ?? null
  }
  return false
}

export function shouldRoutePasteToGrid({
  eventTarget,
  activeElement,
  gridContains,
  cellEditMode,
}: PasteRoutingContext): boolean {
  if (cellEditMode) return false
  if (
    isTextEditingTarget(eventTarget) ||
    isTextEditingTarget(activeElement)
  ) {
    return false
  }
  return gridContains(eventTarget) && gridContains(activeElement)
}

/**
 * Applies the complete Grid Paste contract. A non-grid route returns without
 * reading the clipboard or changing the paste event in any way.
 */
export function handleGridPaste({
  readPlainText,
  preventDefault,
  pasteRange,
  ...routingContext
}: GridPasteHandlingContext): boolean {
  if (!shouldRoutePasteToGrid(routingContext)) return false

  const source = readPlainText()
  if (source === null) return false

  preventDefault()
  pasteRange(source)
  return true
}

/**
 * Copies one focused Grid cell. Native editing targets return without changing
 * either the clipboard or the copy event, preserving partial-text selection.
 */
export function handleGridCopy({
  source,
  writePlainText,
  preventDefault,
  ...routingContext
}: GridCopyHandlingContext): boolean {
  if (!shouldRoutePasteToGrid(routingContext)) return false

  writePlainText(source)
  preventDefault()
  return true
}
