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
