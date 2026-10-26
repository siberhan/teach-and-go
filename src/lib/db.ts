import Dexie, { type EntityTable } from 'dexie'

// The "notebook": everything lives in this browser's IndexedDB, on the teacher's device.

export interface Settings {
  id: 'main'
  groqKey: string
  geminiKey: string
}

export interface Topic {
  id: string
  title: string
  date?: string // YYYY-MM-DD, if the curriculum has dates
}

export interface Plan {
  summary: string
  lessonDays?: string[] // e.g. ['Mon', 'Thu']
  topics: Topic[]
}

export interface Space {
  id: string
  name: string
  createdAt: number
  plan?: Plan
}

export interface Deferred {
  id: string
  text: string
  topicId?: string
  resolved?: boolean
}

export interface Lesson {
  id: string
  spaceId: string
  createdAt: number
  durationSec: number
  status: 'analyzing' | 'done' | 'failed'
  error?: string
  covered?: string[]
  stoppingPoint?: { text: string; topicId?: string }
  deferred?: Deferred[]
}

// Temporary: deleted as soon as analysis succeeds.
export interface AudioBlob {
  lessonId: string
  parts: Blob[]
}

export const db = new Dexie('teach-and-go') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  spaces: EntityTable<Space, 'id'>
  lessons: EntityTable<Lesson, 'id'>
  audio: EntityTable<AudioBlob, 'lessonId'>
}

db.version(1).stores({
  settings: 'id',
  spaces: 'id, createdAt',
  lessons: 'id, spaceId, createdAt, status',
  audio: 'lessonId',
})

export const newId = () => crypto.randomUUID()
