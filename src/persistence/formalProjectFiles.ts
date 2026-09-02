import type { ProjectState } from '../model/types'
import {
  parseProjectFile,
  serializeProjectRecoverySnapshot,
} from './projectFile'

export const DEFAULT_PROJECT_FILENAME =
  'scientific-chart.scientific-chart.json'

export type ProjectFilePermissionState = 'granted' | 'denied' | 'prompt'
export type ProjectFilePermissionMode = 'read' | 'readwrite'

export interface ProjectFileLike {
  name: string
  size: number
  text(): Promise<string>
}

export interface ProjectWritableLike {
  write(contents: string): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

export interface ProjectFileHandleLike {
  name: string
  getFile(): Promise<ProjectFileLike>
  createWritable(): Promise<ProjectWritableLike>
  queryPermission?(descriptor: {
    mode: ProjectFilePermissionMode
  }): Promise<ProjectFilePermissionState>
  requestPermission?(descriptor: {
    mode: ProjectFilePermissionMode
  }): Promise<ProjectFilePermissionState>
}

export interface FileSystemAccessCapabilities {
  open: boolean
  save: boolean
}

export interface FilePickerHost {
  showOpenFilePicker?: (options: unknown) => Promise<ProjectFileHandleLike[]>
  showSaveFilePicker?: (
    options: unknown,
  ) => Promise<ProjectFileHandleLike>
}

export interface ProjectFilePicker {
  readonly capabilities: FileSystemAccessCapabilities
  pickOpen(): Promise<ProjectFileHandleLike | null>
  pickSaveAs(suggestedName: string): Promise<ProjectFileHandleLike | null>
}

export interface DownloadFallback {
  download(contents: string, filename: string): void
}

export interface PersistedFileSession {
  handle: ProjectFileHandleLike
  fileName: string
  savedProjectSnapshot: string
}

export interface FileSessionStorage {
  read(): Promise<unknown | null>
  write(session: PersistedFileSession): Promise<void>
  remove(): Promise<void>
}

export type FileSessionRestoreResult =
  | { kind: 'none' }
  | { kind: 'restored'; session: PersistedFileSession }
  | { kind: 'invalid' }
  | { kind: 'storage-error' }

export type FormalSaveStatus =
  | { state: 'idle' }
  | { state: 'opening' }
  | { state: 'opened' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }

export type FormalSaveResult =
  | {
      kind: 'saved'
      handle: ProjectFileHandleLike | null
      fileName: string
      usedFallback: boolean
    }
  | { kind: 'cancelled' }

export class FormalFilePermissionError extends Error {
  constructor(mode: ProjectFilePermissionMode = 'readwrite') {
    super(
      mode === 'read'
        ? 'このファイルを読み取る権限がありません。もう一度「開く」から選択してください。'
        : 'このファイルへ保存する権限がありません。名前を付けて保存してください。',
    )
    this.name = 'FormalFilePermissionError'
  }
}

export function detectFileSystemAccess(
  host: FilePickerHost,
): FileSystemAccessCapabilities {
  return {
    open: typeof host.showOpenFilePicker === 'function',
    save: typeof host.showSaveFilePicker === 'function',
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

export class BrowserProjectFilePicker implements ProjectFilePicker {
  readonly capabilities: FileSystemAccessCapabilities
  private readonly host: FilePickerHost

  constructor(host: FilePickerHost) {
    this.host = host
    this.capabilities = detectFileSystemAccess(host)
  }

  async pickOpen(): Promise<ProjectFileHandleLike | null> {
    if (!this.host.showOpenFilePicker) return null
    try {
      const handles = await this.host.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Scientific Chart Editor Project',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      })
      return handles[0] ?? null
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }

  async pickSaveAs(
    suggestedName: string,
  ): Promise<ProjectFileHandleLike | null> {
    if (!this.host.showSaveFilePicker) return null
    try {
      return await this.host.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Scientific Chart Editor Project',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      })
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }
}

export function isProjectFileHandleLike(
  value: unknown,
): value is ProjectFileHandleLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'getFile' in value &&
    typeof value.getFile === 'function' &&
    'createWritable' in value &&
    typeof value.createWritable === 'function'
  )
}

export function isPersistedFileSession(
  value: unknown,
): value is PersistedFileSession {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    isProjectFileHandleLike(candidate.handle) &&
    typeof candidate.fileName === 'string' &&
    candidate.fileName.length > 0 &&
    typeof candidate.savedProjectSnapshot === 'string'
  )
}

export async function queryProjectFilePermission(
  handle: ProjectFileHandleLike,
  mode: ProjectFilePermissionMode,
): Promise<ProjectFilePermissionState> {
  if (!handle.queryPermission) return 'prompt'
  return handle.queryPermission({ mode })
}

async function requireProjectFilePermission(
  handle: ProjectFileHandleLike,
  mode: ProjectFilePermissionMode,
): Promise<void> {
  const current = await queryProjectFilePermission(handle, mode)
  if (current === 'granted') return
  if (current !== 'denied' && handle.requestPermission) {
    const requested = await handle.requestPermission({ mode })
    if (requested === 'granted') return
  }
  throw new FormalFilePermissionError(mode)
}

export async function writeProjectFileHandle(
  handle: ProjectFileHandleLike,
  contents: string,
): Promise<void> {
  await requireProjectFilePermission(handle, 'readwrite')
  const writable = await handle.createWritable()
  try {
    await writable.write(contents)
    await writable.close()
  } catch (error) {
    try {
      await writable.abort?.()
    } catch {
      // Preserve the original write error.
    }
    throw error
  }
}

export async function readProjectFileHandle(
  handle: ProjectFileHandleLike,
): Promise<ProjectFileLike> {
  await requireProjectFilePermission(handle, 'read')
  return handle.getFile()
}

export async function saveFormalProjectAs(options: {
  contents: string
  picker: ProjectFilePicker
  fallback: DownloadFallback
  suggestedName?: string
}): Promise<FormalSaveResult> {
  const suggestedName = options.suggestedName ?? DEFAULT_PROJECT_FILENAME
  if (!options.picker.capabilities.save) {
    options.fallback.download(options.contents, suggestedName)
    return {
      kind: 'saved',
      handle: null,
      fileName: suggestedName,
      usedFallback: true,
    }
  }

  const handle = await options.picker.pickSaveAs(suggestedName)
  if (!handle) return { kind: 'cancelled' }
  await writeProjectFileHandle(handle, options.contents)
  return {
    kind: 'saved',
    handle,
    fileName: handle.name,
    usedFallback: false,
  }
}

export async function saveFormalProject(options: {
  contents: string
  currentHandle: ProjectFileHandleLike | null
  picker: ProjectFilePicker
  fallback: DownloadFallback
  suggestedName?: string
}): Promise<FormalSaveResult> {
  if (!options.currentHandle) return saveFormalProjectAs(options)
  await writeProjectFileHandle(options.currentHandle, options.contents)
  return {
    kind: 'saved',
    handle: options.currentHandle,
    fileName: options.currentHandle.name,
    usedFallback: false,
  }
}

export async function restorePersistedFileSession(
  storage: FileSessionStorage,
): Promise<FileSessionRestoreResult> {
  let stored: unknown | null
  try {
    stored = await storage.read()
  } catch {
    return { kind: 'storage-error' }
  }
  if (stored === null) return { kind: 'none' }
  if (!isPersistedFileSession(stored)) {
    try {
      await storage.remove()
    } catch {
      // Invalid metadata must not block startup.
    }
    return { kind: 'invalid' }
  }
  if (!parseProjectFile(stored.savedProjectSnapshot).ok) {
    try {
      await storage.remove()
    } catch {
      // Invalid metadata must not block startup.
    }
    return { kind: 'invalid' }
  }
  try {
    const permission = await queryProjectFilePermission(
      stored.handle,
      'readwrite',
    )
    if (permission === 'denied') {
      await storage.remove()
      return { kind: 'invalid' }
    }
  } catch {
    try {
      await storage.remove()
    } catch {
      // Permission inspection failure is non-fatal.
    }
    return { kind: 'invalid' }
  }
  return { kind: 'restored', session: stored }
}

export function isFormalProjectDirty(
  project: ProjectState,
  savedProjectSnapshot: string | null,
): boolean {
  if (project.datasets.length === 0 && savedProjectSnapshot === null) {
    return false
  }
  if (savedProjectSnapshot === null) return true
  try {
    return serializeProjectRecoverySnapshot(project) !== savedProjectSnapshot
  } catch {
    return true
  }
}

export type ProjectSaveShortcut = 'save' | 'save-as' | null

export function resolveProjectSaveShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  isComposing: boolean
}): ProjectSaveShortcut {
  if (
    event.isComposing ||
    event.altKey ||
    (!event.ctrlKey && !event.metaKey) ||
    event.key.toLowerCase() !== 's'
  ) {
    return null
  }
  return event.shiftKey ? 'save-as' : 'save'
}
