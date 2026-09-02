import type {
  FileSessionStorage,
  PersistedFileSession,
} from './formalProjectFiles'
import {
  FILE_SESSION_STORE_NAME,
  openScientificChartDatabase,
} from './indexedDbAutosave'

export const CURRENT_FILE_SESSION_KEY = 'current-file-handle'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error('IndexedDB transaction was aborted.'),
      )
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

export class IndexedDbFileSessionStorage implements FileSessionStorage {
  private readonly factory: IDBFactory

  constructor(factory: IDBFactory) {
    this.factory = factory
  }

  async read(): Promise<unknown | null> {
    const database = await openScientificChartDatabase(this.factory)
    try {
      const transaction = database.transaction(
        FILE_SESSION_STORE_NAME,
        'readonly',
      )
      const complete = transactionComplete(transaction)
      const value = await requestResult(
        transaction
          .objectStore(FILE_SESSION_STORE_NAME)
          .get(CURRENT_FILE_SESSION_KEY),
      )
      await complete
      return value === undefined ? null : value
    } finally {
      database.close()
    }
  }

  async write(session: PersistedFileSession): Promise<void> {
    const database = await openScientificChartDatabase(this.factory)
    try {
      const transaction = database.transaction(
        FILE_SESSION_STORE_NAME,
        'readwrite',
      )
      const complete = transactionComplete(transaction)
      transaction
        .objectStore(FILE_SESSION_STORE_NAME)
        .put(session, CURRENT_FILE_SESSION_KEY)
      await complete
    } finally {
      database.close()
    }
  }

  async remove(): Promise<void> {
    const database = await openScientificChartDatabase(this.factory)
    try {
      const transaction = database.transaction(
        FILE_SESSION_STORE_NAME,
        'readwrite',
      )
      const complete = transactionComplete(transaction)
      transaction
        .objectStore(FILE_SESSION_STORE_NAME)
        .delete(CURRENT_FILE_SESSION_KEY)
      await complete
    } finally {
      database.close()
    }
  }
}
