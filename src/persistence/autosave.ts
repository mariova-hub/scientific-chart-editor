import type { ProjectState } from '../model/types'
import {
  loadProjectRecoverySnapshotAtomically,
  serializeProjectRecoverySnapshot,
} from './projectFile'

export const AUTOSAVE_DEBOUNCE_MS = 1000

export interface AutosaveRecord {
  serializedProject: string
  savedAt: string
}

export interface AutosaveStorage {
  read(): Promise<unknown | null>
  write(record: AutosaveRecord): Promise<void>
  remove(): Promise<void>
}

export type AutosaveStatus =
  | { state: 'restoring' }
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; savedAt: string }
  | { state: 'error'; message: string }

export type AutosaveRestoreResult =
  | { kind: 'none'; project: ProjectState }
  | { kind: 'restored'; project: ProjectState; record: AutosaveRecord }
  | { kind: 'invalid'; project: ProjectState; message: string }
  | { kind: 'storage-error'; project: ProjectState; message: string }

export type AutosaveSaveResult =
  | { ok: true; record: AutosaveRecord }
  | { ok: false; message: string }

export type AutosaveClearResult =
  | { ok: true }
  | { ok: false; message: string }

interface ProjectAutosaveManagerOptions {
  delayMs?: number
  now?: () => Date
  onStatus?: (status: AutosaveStatus) => void
  onSaved?: (record: AutosaveRecord) => void
}

function isAutosaveRecord(value: unknown): value is AutosaveRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.serializedProject === 'string' &&
    typeof record.savedAt === 'string' &&
    Number.isFinite(Date.parse(record.savedAt))
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function createAutosaveRecord(
  project: ProjectState,
  savedAt: Date = new Date(),
): AutosaveRecord {
  return {
    serializedProject: serializeProjectRecoverySnapshot(project),
    savedAt: savedAt.toISOString(),
  }
}

export async function restoreAutosave(
  storage: AutosaveStorage,
  currentProject: ProjectState,
): Promise<AutosaveRestoreResult> {
  let stored: unknown | null
  try {
    stored = await storage.read()
  } catch (error) {
    return {
      kind: 'storage-error',
      project: currentProject,
      message: errorMessage(
        error,
        '自動保存データを読み取れませんでした。',
      ),
    }
  }

  if (stored === null) return { kind: 'none', project: currentProject }

  if (!isAutosaveRecord(stored)) {
    return {
      kind: 'invalid',
      project: currentProject,
      message: '前回の自動保存データを復元できませんでした。',
    }
  }

  const loaded = loadProjectRecoverySnapshotAtomically(
    currentProject,
    stored.serializedProject,
  )
  if (loaded.error) {
    return {
      kind: 'invalid',
      project: currentProject,
      message: '前回の自動保存データを復元できませんでした。',
    }
  }

  return { kind: 'restored', project: loaded.project, record: stored }
}

export class ProjectAutosaveManager {
  private readonly storage: AutosaveStorage
  private readonly delayMs: number
  private readonly now: () => Date
  private readonly onStatus: (status: AutosaveStatus) => void
  private readonly onSaved: (record: AutosaveRecord) => void
  private timer: ReturnType<typeof setTimeout> | null = null
  private pendingProject: ProjectState | null = null
  private pendingGeneration = 0
  private writeQueue: Promise<void> = Promise.resolve()
  private generation = 0
  private disposed = false

  constructor(
    storage: AutosaveStorage,
    options: ProjectAutosaveManagerOptions = {},
  ) {
    this.storage = storage
    this.delayMs = options.delayMs ?? AUTOSAVE_DEBOUNCE_MS
    this.now = options.now ?? (() => new Date())
    this.onStatus = options.onStatus ?? (() => undefined)
    this.onSaved = options.onSaved ?? (() => undefined)
  }

  private emit(status: AutosaveStatus): void {
    if (!this.disposed) this.onStatus(status)
  }

  async restore(currentProject: ProjectState): Promise<AutosaveRestoreResult> {
    this.emit({ state: 'restoring' })
    const result = await restoreAutosave(this.storage, currentProject)
    if (this.disposed) return result
    if (result.kind === 'restored') {
      this.emit({ state: 'saved', savedAt: result.record.savedAt })
    } else if (result.kind === 'none') {
      this.emit({ state: 'idle' })
    } else {
      if (result.kind === 'invalid') {
        try {
          await this.storage.remove()
        } catch {
          // A corrupted entry must never prevent the application from starting.
        }
      }
      this.emit({ state: 'error', message: result.message })
    }
    return result
  }

  schedule(project: ProjectState): void {
    if (this.disposed) return
    this.pendingProject = project
    this.pendingGeneration = this.generation
    if (this.timer !== null) clearTimeout(this.timer)
    this.emit({ state: 'saving' })
    this.timer = setTimeout(() => {
      this.timer = null
      const pending = this.pendingProject
      const pendingGeneration = this.pendingGeneration
      this.pendingProject = null
      if (pending) void this.enqueueSave(pending, pendingGeneration)
    }, this.delayMs)
  }

  saveNow(project: ProjectState): Promise<AutosaveSaveResult> {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pendingProject = null
    return this.enqueueSave(project, this.generation)
  }

  clearNow(): Promise<AutosaveClearResult> {
    this.cancelPending()
    if (this.disposed) {
      return Promise.resolve({
        ok: false,
        message: '自動保存は終了しています。',
      })
    }
    this.generation += 1
    const clearGeneration = this.generation
    this.emit({ state: 'saving' })
    const operation = this.writeQueue.then(async (): Promise<AutosaveClearResult> => {
      try {
        await this.storage.remove()
        if (clearGeneration === this.generation) {
          this.emit({ state: 'idle' })
        }
        return { ok: true }
      } catch {
        const message =
          '自動保存に失敗しました。プロジェクトファイルとして保存してください。'
        if (clearGeneration === this.generation) {
          this.emit({ state: 'error', message })
        }
        return { ok: false, message }
      }
    })
    this.writeQueue = operation.then(() => undefined)
    return operation
  }

  private enqueueSave(
    project: ProjectState,
    saveGeneration: number,
  ): Promise<AutosaveSaveResult> {
    if (this.disposed) {
      return Promise.resolve({
        ok: false,
        message: '自動保存は終了しています。',
      })
    }
    this.emit({ state: 'saving' })
    const operation = this.writeQueue.then(async (): Promise<AutosaveSaveResult> => {
      try {
        const record = createAutosaveRecord(project, this.now())
        await this.storage.write(record)
        if (saveGeneration === this.generation) {
          this.onSaved(record)
          this.emit({ state: 'saved', savedAt: record.savedAt })
        }
        return { ok: true, record }
      } catch (error) {
        void error
        const message =
          '自動保存に失敗しました。プロジェクトファイルとして保存してください。'
        if (saveGeneration === this.generation) {
          this.emit({ state: 'error', message })
        }
        return { ok: false, message }
      }
    })
    this.writeQueue = operation.then(() => undefined)
    return operation
  }

  async whenIdle(): Promise<void> {
    await this.writeQueue
  }

  cancelPending(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pendingProject = null
  }

  dispose(): void {
    this.disposed = true
    this.cancelPending()
  }
}
