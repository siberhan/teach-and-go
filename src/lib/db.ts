import Dexie, { type EntityTable } from 'dexie'

// The "notebook": everything lives in this browser's IndexedDB, on the teacher's device.

export interface Settings {
  id: 'main'
  openrouterKey: string
  groqKey?: string // optional: free speech-to-text, OpenRouter is the fallback
}

export interface Topic {
  id: string
  title: string
  date?: string // YYYY-MM-DD, if the curriculum has dates
  lessons?: number // how many lessons the topic takes, only if the teacher said so (default 1)
}

// The teacher's routine. Only filled from what the teacher or the document says, never guessed.
// Either weekly slots (two lessons on one day = two slots) or every N days at given times.
export interface Schedule {
  slots?: { day: string; time?: string }[] // day: 'Mon'…'Sun', time: 'HH:MM'
  everyDays?: number
  times?: string[]
  startDate?: string // YYYY-MM-DD
}

export interface Plan {
  summary: string
  lessonDays?: string[] // older plans: e.g. ['Mon', 'Thu']; new plans use schedule
  schedule?: Schedule
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
  stoppingPoint?: { text: string; topicId?: string; topicFinished?: boolean }
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
