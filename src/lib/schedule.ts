import type { Plan, Schedule, Topic } from './db.ts'

// Pure functions, no AI: lesson dates come from the teacher's routine.

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const parseDay = (s: string) => new Date(s + 'T00:00:00')

export interface LessonTime {
  date: Date
  time?: string
}

// The plan's routine, if it has one. Older plans only had weekly lesson days.
export function scheduleOf(plan?: Plan): Schedule | undefined {
  const s = plan?.schedule
  if (s?.slots?.length || s?.everyDays) return s
  if (plan?.lessonDays?.length) return { slots: plan.lessonDays.map((day) => ({ day })) }
  return undefined
}

// The next `count` lessons on or after `from`, in order.
export function lessonTimes(s: Schedule, from: Date, count: number): LessonTime[] {
  const first = dayStart(from)
  const start = s.startDate && parseDay(s.startDate) > first ? parseDay(s.startDate) : first
  const out: LessonTime[] = []
  if (s.everyDays && s.everyDays > 0) {
    const times = s.times?.length ? [...s.times].sort() : [undefined]
    for (let d = s.startDate ? parseDay(s.startDate) : start, i = 0; out.length < count && i < 1000; d = addDays(d, s.everyDays), i++) {
      if (d >= start) for (const time of times) out.push({ date: d, time })
    }
  } else if (s.slots?.length) {
    for (let i = 0; out.length < count && i < 1000; i++) {
      const d = addDays(start, i)
      const today = s.slots.filter((x) => x.day === WEEKDAYS[d.getDay()]).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      for (const x of today) out.push({ date: d, time: x.time })
    }
  }
  return out.slice(0, count)
}

const shortDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// "Tue 19:00 · Fri 19:00 · from Nov 4" or "Every 2 days at 10:00".
export function describeSchedule(s?: Schedule): string | undefined {
  if (!s) return undefined
  const from = s.startDate ? ` · from ${shortDay(parseDay(s.startDate))}` : ''
  if (s.everyDays) {
    const at = s.times?.length ? ` at ${s.times.join(' and ')}` : ''
    return (s.everyDays === 1 ? 'Every day' : `Every ${s.everyDays} days`) + at + from
  }
  if (!s.slots?.length) return undefined
  const order = (d: string) => (WEEKDAYS.indexOf(d) + 6) % 7
  const slots = [...s.slots].sort((a, b) => order(a.day) - order(b.day) || (a.time ?? '').localeCompare(b.time ?? ''))
  return slots.map((x) => (x.time ? `${x.day} ${x.time}` : x.day)).join(' · ') + from
}

export interface ScheduleRow {
  topic: Topic
  state: 'done' | 'next' | 'later'
  when?: LessonTime
  estimated: boolean // date worked out from the routine, not written in the curriculum
}

// Every topic with its lesson date: taught topics first, then the coming ones placed on the routine.
export function scheduleRows(plan: Plan, nextIndex: number, now = new Date()): ScheduleRow[] {
  const s = scheduleOf(plan)
  const coming = plan.topics.slice(nextIndex)
  const needed = coming.reduce((n, t) => n + Math.max(1, t.lessons ?? 1), 0)
  const times = s ? lessonTimes(s, now, needed) : []
  let at = 0
  return plan.topics.map((topic, i) => {
    if (i < nextIndex) return { topic, state: 'done', estimated: false }
    const slot = times[at]
    at += Math.max(1, topic.lessons ?? 1)
    const state = i === nextIndex ? 'next' : 'later'
    if (topic.date) return { topic, state, when: { date: parseDay(topic.date), time: slot?.time }, estimated: false }
    return { topic, state, when: slot, estimated: !!slot }
  })
}
