import type { Deferred, Lesson, Plan, Topic } from './db.ts'

// Pure functions, no AI: everything the Thread card shows is computed from the notebook.

export function lastDoneLesson(lessons: Lesson[]): Lesson | undefined {
  return lessons.filter((l) => l.status === 'done').sort((a, b) => b.createdAt - a.createdAt)[0]
}

export function openDeferred(lessons: Lesson[]): Deferred[] {
  return lessons.flatMap((l) => l.deferred ?? []).filter((d) => !d.resolved)
}

// The topic the next lesson should be about.
export function nextTopic(plan: Plan | undefined, lastStop: Lesson['stoppingPoint']): Topic | undefined {
  if (!plan?.topics.length) return undefined
  const i = plan.topics.findIndex((t) => t.id === lastStop?.topicId)
  if (i === -1) return lastStop ? undefined : plan.topics[0]
  return lastStop?.topicFinished ? plan.topics[i + 1] : plan.topics[i]
}

export interface ThreadCard {
  kind: 'setup' | 'first' | 'continue'
  startAt?: string // what to start the next lesson with
  lastStop?: string // where the last lesson stopped
  topic?: Topic
  reminders: Deferred[] // deferred items that belong to the next topic
  waiting: Deferred[] // other open deferred items, for the detail view
}

export function threadCard(plan: Plan | undefined, lessons: Lesson[]): ThreadCard {
  const last = lastDoneLesson(lessons)
  const open = openDeferred(lessons)
  if (!last) return { kind: plan ? 'first' : 'setup', topic: nextTopic(plan, undefined), reminders: [], waiting: open }
  const topic = nextTopic(plan, last.stoppingPoint)
  const reminders = topic ? open.filter((d) => d.topicId === topic.id) : []
  return {
    kind: 'continue',
    startAt: last.stoppingPoint?.topicFinished ? (topic?.title ?? 'Plan finished') : last.stoppingPoint?.text,
    lastStop: last.stoppingPoint?.text,
    topic,
    reminders,
    waiting: open.filter((d) => !reminders.includes(d)),
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Next lesson date for a plan: the first topic date from today, or the next lesson weekday.
export function nextLessonDate(plan: Plan | undefined, now = new Date()): Date | undefined {
  if (!plan) return undefined
  const today = dayStart(now)
  const dated = plan.topics
    .map((t) => (t.date ? new Date(t.date + 'T00:00:00') : undefined))
    .filter((d): d is Date => !!d && d >= today)
    .sort((a, b) => +a - +b)
  if (dated.length) return dated[0]
  if (!plan.lessonDays?.length) return undefined
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    if (plan.lessonDays.includes(WEEKDAYS[d.getDay()])) return d
  }
  return undefined
}

export interface Upcoming {
  spaceId: string
  spaceName: string
  date: Date
  topic?: string
}

// Upcoming lessons across spaces, soonest first. Used for the Start screen bell and space order.
export function upcomingLessons(
  spaces: { id: string; name: string; plan?: Plan }[],
  lessons: Lesson[],
  now = new Date(),
): Upcoming[] {
  return spaces
    .flatMap((s) => {
      const date = nextLessonDate(s.plan, now)
      if (!date) return []
      const mine = lessons.filter((l) => l.spaceId === s.id)
      return [{ spaceId: s.id, spaceName: s.name, date, topic: nextTopic(s.plan, lastDoneLesson(mine)?.stoppingPoint)?.title }]
    })
    .sort((a, b) => +a.date - +b.date)
}

// Spaces with the nearest upcoming lesson first; spaces without lesson days follow, newest first.
export function sortSpaces<S extends { id: string; createdAt: number; plan?: Plan }>(spaces: S[], now = new Date()): S[] {
  const when = (s: S) => nextLessonDate(s.plan, now)?.getTime() ?? Infinity
  return [...spaces].sort((a, b) => when(a) - when(b) || b.createdAt - a.createdAt)
}

export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((+dayStart(date) - +dayStart(now)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString(undefined, diff < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' })
}
