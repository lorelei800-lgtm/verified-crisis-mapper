/**
 * Offline submission queue using IndexedDB.
 *
 * When the user submits a report without network connectivity, the report
 * and its photo are stored here. App.tsx processes the queue when the
 * device comes back online.
 */
import type { DamageReport } from '../types'

const DB_NAME = 'vcm-offline-queue'
const DB_VER  = 1
const STORE   = 'reports'

export interface QueuedReport {
  queueId:  string
  report:   DamageReport
  photo?:   Blob          // compressed photo, stored as binary
  addedAt:  number        // unix ms
  attempts: number        // sync attempt count
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'queueId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function enqueueReport(report: DamageReport, photo?: File | null): Promise<string> {
  const db      = await openDb()
  const queueId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const item: QueuedReport = {
    queueId,
    report,
    photo:    photo ?? undefined,
    addedAt:  Date.now(),
    attempts: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(item)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
  db.close()
  return queueId
}

export async function getAllQueued(): Promise<QueuedReport[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => { db.close(); resolve(req.result as QueuedReport[]) }
    req.onerror   = () => { db.close(); reject(req.error) }
  })
}

export async function removeQueued(queueId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(queueId)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror    = () => { db.close(); reject(tx.error) }
  })
}

export async function countQueued(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror   = () => { db.close(); reject(req.error) }
  })
}

export async function incrementAttempts(queueId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req   = store.get(queueId)
    req.onsuccess = () => {
      const item = req.result as QueuedReport | undefined
      if (item) {
        item.attempts += 1
        store.put(item)
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror    = () => { db.close(); reject(tx.error) }
  })
}
