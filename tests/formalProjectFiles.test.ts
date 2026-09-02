import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../src/model/createProject'
import {
  detectFileSystemAccess,
  FormalFilePermissionError,
  isFormalProjectDirty,
  readProjectFileHandle,
  resolveProjectSaveShortcut,
  restorePersistedFileSession,
  saveFormalProject,
  saveFormalProjectAs,
  type DownloadFallback,
  type FileSessionStorage,
  type PersistedFileSession,
  type ProjectFileHandleLike,
  type ProjectFileLike,
  type ProjectFilePermissionState,
  type ProjectFilePicker,
  type ProjectWritableLike,
} from '../src/persistence/formalProjectFiles'
import {
  loadProjectAtomically,
  serializeProjectFile,
} from '../src/persistence/projectFile'
import { sampleBarProject, sampleProject, sequentialIds } from './helpers'

class FakeHandle implements ProjectFileHandleLike {
  readonly name: string
  contents: string
  permission: ProjectFilePermissionState = 'granted'
  requestedPermission: ProjectFilePermissionState | null = null
  failWrite = false
  failClose = false
  closeCount = 0
  abortCount = 0

  constructor(name: string, contents = '') {
    this.name = name
    this.contents = contents
  }

  async queryPermission(): Promise<ProjectFilePermissionState> {
    return this.permission
  }

  async requestPermission(): Promise<ProjectFilePermissionState> {
    return this.requestedPermission ?? this.permission
  }

  async getFile(): Promise<ProjectFileLike> {
    return {
      name: this.name,
      size: new TextEncoder().encode(this.contents).byteLength,
      text: async () => this.contents,
    }
  }

  async createWritable(): Promise<ProjectWritableLike> {
    let pending = this.contents
    return {
      write: async (contents) => {
        if (this.failWrite) throw new Error('write failed')
        pending = contents
      },
      close: async () => {
        if (this.failClose) throw new Error('close failed')
        this.closeCount += 1
        this.contents = pending
      },
      abort: async () => {
        this.abortCount += 1
      },
    }
  }
}

class FakePicker implements ProjectFilePicker {
  capabilities = { open: true, save: true }
  openHandle: ProjectFileHandleLike | null = null
  saveHandle: ProjectFileHandleLike | null = null
  openCount = 0
  saveCount = 0

  async pickOpen(): Promise<ProjectFileHandleLike | null> {
    this.openCount += 1
    return this.openHandle
  }

  async pickSaveAs(): Promise<ProjectFileHandleLike | null> {
    this.saveCount += 1
    return this.saveHandle
  }
}

class MemoryFileSessionStorage implements FileSessionStorage {
  value: unknown | null = null
  removeCount = 0

  async read(): Promise<unknown | null> {
    return this.value
  }

  async write(session: PersistedFileSession): Promise<void> {
    this.value = session
  }

  async remove(): Promise<void> {
    this.value = null
    this.removeCount += 1
  }
}

function fallbackSpy() {
  const download = vi.fn<(contents: string, filename: string) => void>()
  return { fallback: { download } satisfies DownloadFallback, download }
}

describe('formal project file persistence', () => {
  it('overwrites the current handle without opening Save As', async () => {
    const handle = new FakeHandle('experiment.scientific-chart.json', 'old')
    const picker = new FakePicker()
    const { fallback, download } = fallbackSpy()

    const result = await saveFormalProject({
      contents: 'new project',
      currentHandle: handle,
      picker,
      fallback,
    })

    expect(result).toMatchObject({
      kind: 'saved',
      handle,
      usedFallback: false,
    })
    expect(handle.contents).toBe('new project')
    expect(handle.closeCount).toBe(1)
    expect(picker.saveCount).toBe(0)
    expect(download).not.toHaveBeenCalled()
  })

  it('uses Save As when Save has no current handle', async () => {
    const handle = new FakeHandle('first.scientific-chart.json')
    const picker = new FakePicker()
    picker.saveHandle = handle
    const { fallback } = fallbackSpy()

    const result = await saveFormalProject({
      contents: 'first project',
      currentHandle: null,
      picker,
      fallback,
    })

    expect(result).toMatchObject({ kind: 'saved', handle })
    expect(picker.saveCount).toBe(1)
    expect(handle.contents).toBe('first project')
  })

  it('Save As selects and writes a new handle', async () => {
    const handle = new FakeHandle('copy.scientific-chart.json')
    const picker = new FakePicker()
    picker.saveHandle = handle
    const { fallback } = fallbackSpy()

    const result = await saveFormalProjectAs({
      contents: 'copy project',
      picker,
      fallback,
    })

    expect(result).toMatchObject({
      kind: 'saved',
      handle,
      fileName: 'copy.scientific-chart.json',
    })
    expect(handle.contents).toBe('copy project')
  })

  it('does not report success or replace contents when a write fails', async () => {
    const handle = new FakeHandle('failed.scientific-chart.json', 'original')
    handle.failWrite = true

    await expect(
      saveFormalProject({
        contents: 'broken',
        currentHandle: handle,
        picker: new FakePicker(),
        fallback: fallbackSpy().fallback,
      }),
    ).rejects.toThrow('write failed')

    expect(handle.contents).toBe('original')
    expect(handle.closeCount).toBe(0)
    expect(handle.abortCount).toBe(1)
  })

  it('does not report success until the writable stream closes', async () => {
    const handle = new FakeHandle('failed-close.scientific-chart.json', 'original')
    handle.failClose = true

    await expect(
      saveFormalProject({
        contents: 'not committed',
        currentHandle: handle,
        picker: new FakePicker(),
        fallback: fallbackSpy().fallback,
      }),
    ).rejects.toThrow('close failed')

    expect(handle.contents).toBe('original')
    expect(handle.closeCount).toBe(0)
    expect(handle.abortCount).toBe(1)
  })

  it('rejects overwrite when read/write permission is denied', async () => {
    const handle = new FakeHandle('denied.scientific-chart.json')
    handle.permission = 'denied'

    await expect(
      saveFormalProject({
        contents: 'project',
        currentHandle: handle,
        picker: new FakePicker(),
        fallback: fallbackSpy().fallback,
      }),
    ).rejects.toBeInstanceOf(FormalFilePermissionError)
  })

  it('requests a prompted write permission only during the save operation', async () => {
    const handle = new FakeHandle('prompt.scientific-chart.json')
    handle.permission = 'prompt'
    handle.requestedPermission = 'granted'

    await saveFormalProject({
      contents: 'permitted project',
      currentHandle: handle,
      picker: new FakePicker(),
      fallback: fallbackSpy().fallback,
    })

    expect(handle.contents).toBe('permitted project')
  })

  it('reads a selected handle and atomically validates the project', async () => {
    const opened = sampleBarProject()
    const handle = new FakeHandle(
      'opened.scientific-chart.json',
      serializeProjectFile(opened),
    )
    const file = await readProjectFileHandle(handle)
    const current = sampleProject('x\ty\n1\t1')
    const result = loadProjectAtomically(current, await file.text())

    expect(result.error).toBeNull()
    expect(result.project).toEqual(opened)
    expect(file.name).toBe('opened.scientific-chart.json')
  })

  it('uses the download fallback when File System Access is unsupported', async () => {
    const picker = new FakePicker()
    picker.capabilities = { open: false, save: false }
    const { fallback, download } = fallbackSpy()

    const result = await saveFormalProject({
      contents: 'fallback project',
      currentHandle: null,
      picker,
      fallback,
    })

    expect(result).toMatchObject({
      kind: 'saved',
      handle: null,
      usedFallback: true,
    })
    expect(download).toHaveBeenCalledWith(
      'fallback project',
      'scientific-chart.scientific-chart.json',
    )
  })
})

describe('file session restoration and dirty state', () => {
  it('restores a persisted handle when permission remains granted', async () => {
    const project = sampleBarProject()
    const handle = new FakeHandle('restored.scientific-chart.json')
    const storage = new MemoryFileSessionStorage()
    storage.value = {
      handle,
      fileName: handle.name,
      savedProjectSnapshot: serializeProjectFile(project),
    }

    const result = await restorePersistedFileSession(storage)

    expect(result.kind).toBe('restored')
    expect(storage.removeCount).toBe(0)
  })

  it('removes a persisted handle after permission is denied', async () => {
    const project = sampleBarProject()
    const handle = new FakeHandle('denied.scientific-chart.json')
    handle.permission = 'denied'
    const storage = new MemoryFileSessionStorage()
    storage.value = {
      handle,
      fileName: handle.name,
      savedProjectSnapshot: serializeProjectFile(project),
    }

    const result = await restorePersistedFileSession(storage)

    expect(result.kind).toBe('invalid')
    expect(storage.value).toBeNull()
  })

  it('keeps a prompted persisted handle without requesting permission at startup', async () => {
    const project = sampleBarProject()
    const handle = new FakeHandle('prompt.scientific-chart.json')
    handle.permission = 'prompt'
    const storage = new MemoryFileSessionStorage()
    storage.value = {
      handle,
      fileName: handle.name,
      savedProjectSnapshot: serializeProjectFile(project),
    }

    const result = await restorePersistedFileSession(storage)

    expect(result.kind).toBe('restored')
    expect(storage.removeCount).toBe(0)
  })

  it('removes persisted handle metadata with an invalid project snapshot', async () => {
    const handle = new FakeHandle('invalid.scientific-chart.json')
    const storage = new MemoryFileSessionStorage()
    storage.value = {
      handle,
      fileName: handle.name,
      savedProjectSnapshot: '{invalid json',
    }

    const result = await restorePersistedFileSession(storage)

    expect(result.kind).toBe('invalid')
    expect(storage.value).toBeNull()
  })

  it('keeps dirty true across autosave and clears it after formal save/open', () => {
    const saved = sampleBarProject()
    const savedSnapshot = serializeProjectFile(saved)
    const edited = structuredClone(saved)
    edited.chart.title.text = 'edited after formal save'

    expect(isFormalProjectDirty(saved, savedSnapshot)).toBe(false)
    expect(isFormalProjectDirty(edited, savedSnapshot)).toBe(true)
    expect(isFormalProjectDirty(edited, savedSnapshot)).toBe(true)
    expect(
      isFormalProjectDirty(edited, serializeProjectFile(edited)),
    ).toBe(false)
    expect(
      isFormalProjectDirty(
        createEmptyProject(
          sequentialIds('new'),
          '2026-09-02T00:00:00.000Z',
        ),
        null,
      ),
    ).toBe(false)
  })

  it('detects open and save picker capabilities independently', () => {
    expect(detectFileSystemAccess({})).toEqual({ open: false, save: false })
    expect(
      detectFileSystemAccess({
        showOpenFilePicker: async () => [],
      }),
    ).toEqual({ open: true, save: false })
  })
})

describe('project save keyboard shortcuts', () => {
  it.each([
    ['Ctrl+S', true, false, false, 'save'],
    ['Cmd+S', false, true, false, 'save'],
    ['Ctrl+Shift+S', true, false, true, 'save-as'],
    ['Cmd+Shift+S', false, true, true, 'save-as'],
  ])(
    'maps %s',
    (_label, ctrlKey, metaKey, shiftKey, expected) => {
      expect(
        resolveProjectSaveShortcut({
          key: 's',
          ctrlKey,
          metaKey,
          shiftKey,
          altKey: false,
          isComposing: false,
        }),
      ).toBe(expected)
    },
  )

  it('does not intercept IME composition or unrelated keys', () => {
    expect(
      resolveProjectSaveShortcut({
        key: 's',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        isComposing: true,
      }),
    ).toBeNull()
    expect(
      resolveProjectSaveShortcut({
        key: 'p',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        isComposing: false,
      }),
    ).toBeNull()
  })
})
