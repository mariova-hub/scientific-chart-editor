import type { AutosaveRecord, AutosaveStorage } from './autosave'

export const AUTOSAVE_DATABASE_NAME = 'scientific-chart-editor'
export const AUTOSAVE_STORE_NAME = 'autosave'
export const AUTOSAVE_CURRENT_PROJECT_KEY = 'current-project'
const AUTOSAVE_DATABASE_VERSION = 1

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

export class IndexedDbAutosaveStorage implements AutosaveStorage {
  private readonly factory: IDBFactory

  constructor(factory: IDBFactory) {
    this.factory = factory
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(
        AUTOSAVE_DATABASE_NAME,
        AUTOSAVE_DATABASE_VERSION,
      )
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(AUTOSAVE_STORE_NAME)) {
          database.createObjectStore(AUTOSAVE_STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした。'))
      request.onblocked = () => reject(new Error('IndexedDBの更新が別のタブによりブロックされています。'))
    })
  }

  async read(): Promise<unknown | null> {
    const database = await this.open()
    try {
      const transaction = database.transaction(AUTOSAVE_STORE_NAME, 'readonly')
      const complete = transactionComplete(transaction)
      const value = await requestResult(
        transaction.objectStore(AUTOSAVE_STORE_NAME).get(AUTOSAVE_CURRENT_PROJECT_KEY),
      )
      await complete
      return value === undefined ? null : value
    } finally {
      database.close()
    }
  }

  async write(record: AutosaveRecord): Promise<void> {
    const database = await this.open()
    try {
      const transaction = database.transaction(AUTOSAVE_STORE_NAME, 'readwrite')
      const complete = transactionComplete(transaction)
      transaction
        .objectStore(AUTOSAVE_STORE_NAME)
        .put(record, AUTOSAVE_CURRENT_PROJECT_KEY)
      await complete
    } finally {
      database.close()
    }
  }

  async remove(): Promise<void> {
    const database = await this.open()
    try {
      const transaction = database.transaction(AUTOSAVE_STORE_NAME, 'readwrite')
      const complete = transactionComplete(transaction)
      transaction
        .objectStore(AUTOSAVE_STORE_NAME)
        .delete(AUTOSAVE_CURRENT_PROJECT_KEY)
      await complete
    } finally {
      database.close()
    }
  }
}
