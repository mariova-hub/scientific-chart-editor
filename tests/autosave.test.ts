import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAutosaveRecord,
  ProjectAutosaveManager,
  restoreAutosave,
  type AutosaveRecord,
  type AutosaveStatus,
  type AutosaveStorage,
} from '../src/persistence/autosave'
import {
  parseProjectFile,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { sampleBarProject, sampleProject } from './helpers'

class MemoryAutosaveStorage implements AutosaveStorage {
  value: unknown | null = null
  writes: AutosaveRecord[] = []
  removeCount = 0
  failWrites = false
  writeGate: Promise<void> | null = null

  async read(): Promise<unknown | null> {
    return this.value
  }

  async write(record: AutosaveRecord): Promise<void> {
    if (this.failWrites) throw new Error('quota')
    if (this.writeGate) await this.writeGate
    this.value = record
    this.writes.push(record)
  }

  async remove(): Promise<void> {
    this.value = null
    this.removeCount += 1
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('autosave serialization and restore', () => {
  it('stores the existing project serialization with an ISO savedAt', () => {
    const project = sampleBarProject()
    const savedAt = new Date('2026-09-02T01:42:00.000Z')
    const record = createAutosaveRecord(project, savedAt)

    expect(record).toEqual({
      serializedProject: serializeProjectFile(project),
      savedAt: '2026-09-02T01:42:00.000Z',
    })
  })

  it('restores a valid autosave through the project parser', async () => {
    const current = sampleProject('x\ty\n1\t1')
    const restored = sampleBarProject()
    const storage = new MemoryAutosaveStorage()
    storage.value = createAutosaveRecord(restored)

    const result = await restoreAutosave(storage, current)

    expect(result.kind).toBe('restored')
    expect(result.project).toEqual(restored)
  })

  it('saves and restores pasted table data while required bindings are unset', async () => {
    const current = sampleProject('before\tvalue\n1\t2')
    const working = sampleProject('試験管\n3\n4')
    const storage = new MemoryAutosaveStorage()

    expect(working.chart.series[0].bindings.x).not.toBeNull()
    expect(working.chart.series[0].bindings.y).toBeNull()
    expect(() => serializeProjectFile(working)).toThrow()
    storage.value = createAutosaveRecord(working)

    const result = await restoreAutosave(storage, current)

    expect(result.kind).toBe('restored')
    expect(result.project.datasets[0]).toEqual(working.datasets[0])
    expect(result.project.chart.series[0].bindings.x).not.toBeNull()
    expect(result.project.chart.series[0].bindings.y).toBeNull()
  })

  it('hydrates an older schema 0.1 autosave through the shared parser', async () => {
    const current = sampleProject('x\ty\n1\t1')
    const file = JSON.parse(serializeProjectFile(sampleBarProject()))
    delete file.project.chart.bar.gapPercent
    file.project.chart.bar.gapRatio = 0.2
    const storage = new MemoryAutosaveStorage()
    storage.value = {
      serializedProject: JSON.stringify(file),
      savedAt: '2026-09-02T01:42:00.000Z',
    }

    const result = await restoreAutosave(storage, current)

    expect(result.kind).toBe('restored')
    expect(result.project.chart.bar.gapPercent).toBe(25)
  })

  it('returns the current project unchanged when there is no autosave', async () => {
    const current = sampleBarProject()
    const result = await restoreAutosave(new MemoryAutosaveStorage(), current)

    expect(result).toEqual({ kind: 'none', project: current })
    expect(result.project).toBe(current)
  })

  it.each([
    ['invalid JSON', '{broken'],
    [
      'invalid project',
      (() => {
        const file = JSON.parse(serializeProjectFile(sampleBarProject()))
        file.project.chart.axes[0].scale.minimum = 10
        file.project.chart.axes[0].scale.maximum = 1
        return JSON.stringify(file)
      })(),
    ],
  ])('keeps the current project for %s', async (_label, serializedProject) => {
    const current = sampleProject('x\ty\n1\t1')
    const storage = new MemoryAutosaveStorage()
    storage.value = {
      serializedProject,
      savedAt: '2026-09-02T01:42:00.000Z',
    }

    const result = await restoreAutosave(storage, current)

    expect(result.kind).toBe('invalid')
    expect(result.project).toBe(current)
  })

  it('rejects a malformed autosave envelope', async () => {
    const current = sampleBarProject()
    const storage = new MemoryAutosaveStorage()
    storage.value = { serializedProject: serializeProjectFile(current) }

    const result = await restoreAutosave(storage, current)

    expect(result.kind).toBe('invalid')
    expect(result.project).toBe(current)
  })
})

describe('autosave manager', () => {
  it('debounces continuous updates and writes only the latest project', async () => {
    vi.useFakeTimers()
    const storage = new MemoryAutosaveStorage()
    const manager = new ProjectAutosaveManager(storage, {
      delayMs: 1000,
      now: () => new Date('2026-09-02T01:42:00.000Z'),
    })
    const first = sampleBarProject()
    const second = structuredClone(first)
    second.chart.title.text = 'second'
    const latest = structuredClone(first)
    latest.chart.title.text = 'latest'

    manager.schedule(first)
    manager.schedule(second)
    manager.schedule(latest)
    await vi.advanceTimersByTimeAsync(999)
    expect(storage.writes).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    await manager.whenIdle()

    expect(storage.writes).toHaveLength(1)
    const parsed = parseProjectFile(storage.writes[0].serializedProject)
    expect(parsed.ok && parsed.project.chart.title.text).toBe('latest')
  })

  it('updates autosave immediately after a formal file load contract', async () => {
    const storage = new MemoryAutosaveStorage()
    const manager = new ProjectAutosaveManager(storage)
    const loaded = sampleBarProject()
    loaded.chart.title.text = 'loaded project'

    const result = await manager.saveNow(loaded)

    expect(result.ok).toBe(true)
    expect(storage.writes).toHaveLength(1)
    const parsed = parseProjectFile(storage.writes[0].serializedProject)
    expect(parsed.ok && parsed.project.chart.title.text).toBe('loaded project')
  })

  it('removes the recovery snapshot when a new empty project is confirmed', async () => {
    const storage = new MemoryAutosaveStorage()
    storage.value = createAutosaveRecord(sampleBarProject())
    const statuses: AutosaveStatus[] = []
    const manager = new ProjectAutosaveManager(storage, {
      onStatus: (status) => statuses.push(status),
    })

    const result = await manager.clearNow()

    expect(result).toEqual({ ok: true })
    expect(storage.value).toBeNull()
    expect(storage.removeCount).toBe(1)
    expect(statuses.at(-1)).toEqual({ state: 'idle' })
  })

  it('cancels an old debounced save before clearing for a new project', async () => {
    vi.useFakeTimers()
    const storage = new MemoryAutosaveStorage()
    const manager = new ProjectAutosaveManager(storage, { delayMs: 1000 })

    manager.schedule(sampleBarProject())
    const cleared = manager.clearNow()
    await vi.advanceTimersByTimeAsync(1500)
    await cleared
    await manager.whenIdle()

    expect(storage.writes).toHaveLength(0)
    expect(storage.value).toBeNull()
    const restored = await restoreAutosave(storage, sampleBarProject())
    expect(restored.kind).toBe('none')
  })

  it('queues clear after an in-flight old write and ignores its stale callback', async () => {
    let releaseWrite = () => undefined
    const storage = new MemoryAutosaveStorage()
    storage.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    const saved: AutosaveRecord[] = []
    const manager = new ProjectAutosaveManager(storage, {
      onSaved: (record) => saved.push(record),
    })

    const oldSave = manager.saveNow(sampleBarProject())
    await Promise.resolve()
    const cleared = manager.clearNow()
    releaseWrite()
    await oldSave
    await cleared
    await manager.whenIdle()

    expect(storage.writes).toHaveLength(1)
    expect(storage.removeCount).toBe(1)
    expect(storage.value).toBeNull()
    expect(saved).toHaveLength(0)
  })

  it('removes an invalid autosave and reports a non-fatal restore error', async () => {
    const storage = new MemoryAutosaveStorage()
    storage.value = {
      serializedProject: '{broken',
      savedAt: '2026-09-02T01:42:00.000Z',
    }
    const statuses: AutosaveStatus[] = []
    const current = sampleBarProject()
    const manager = new ProjectAutosaveManager(storage, {
      onStatus: (status) => statuses.push(status),
    })

    const result = await manager.restore(current)

    expect(result.kind).toBe('invalid')
    expect(result.project).toBe(current)
    expect(storage.removeCount).toBe(1)
    expect(statuses.at(-1)).toEqual({
      state: 'error',
      message: '前回の自動保存データを復元できませんでした。',
    })
  })

  it('keeps editing available and reports a write failure', async () => {
    const storage = new MemoryAutosaveStorage()
    storage.failWrites = true
    const statuses: AutosaveStatus[] = []
    const manager = new ProjectAutosaveManager(storage, {
      onStatus: (status) => statuses.push(status),
    })

    const result = await manager.saveNow(sampleBarProject())

    expect(result).toEqual({
      ok: false,
      message:
        '自動保存に失敗しました。プロジェクトファイルとして保存してください。',
    })
    expect(statuses.at(-1)).toEqual({
      state: 'error',
      message:
        '自動保存に失敗しました。プロジェクトファイルとして保存してください。',
    })
  })
})
