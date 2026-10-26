// Plan check with real Gemini calls:
// 1. demo curriculum (no dates) → topics, routine left empty, one question with options about the routine;
// 2. answering it → weekly slots with times, topic ids kept;
// 3. a new document on an existing plan with no instruction → plan untouched, a question with options;
// 4. a clear instruction → the plan changes.
import { readFileSync } from 'node:fs'
import { planTurn } from '../src/lib/ai.ts'
import { loadEnv } from './env.mjs'

const { OPENROUTER_KEY } = loadEnv()
const pdf = [{ name: 'curriculum.pdf', mimeType: 'application/pdf', data: new Blob([readFileSync('demo/curriculum.pdf')]) }]
const r = {}

const first = await planTurn(OPENROUTER_KEY, { taught: [], files: pdf, message: '' })
r.topics = first.plan.topics.length
r.firstSchedule = first.plan.schedule ?? null
r.firstQuestion = first.question

const answered = await planTurn(OPENROUTER_KEY, { plan: first.plan, taught: [], files: [], message: 'Tuesday and Friday at 19:00, starting next week', asked: first.question })
r.slots = answered.plan.schedule?.slots
r.startDate = answered.plan.schedule?.startDate
r.keptIds = answered.plan.topics.filter((t) => first.plan.topics.some((o) => o.id === t.id)).length

const newDoc = await planTurn(OPENROUTER_KEY, { plan: answered.plan, taught: [answered.plan.topics[0].title], files: pdf, message: '' })
r.newDocChanged = newDoc.changed
r.newDocQuestion = newDoc.question
r.newDocSamePlan = newDoc.plan === answered.plan

const twice = await planTurn(OPENROUTER_KEY, { plan: answered.plan, taught: [], files: [], message: 'Saturday lessons are twice: 10:00 and 15:00. Drop Tuesday and Friday.' })
r.twiceSlots = twice.plan.schedule?.slots

console.log(JSON.stringify({ firstQ: r.firstQuestion?.text, slots: r.slots, startDate: r.startDate, keptIds: r.keptIds, newDocChanged: r.newDocChanged, newDocQ: r.newDocQuestion?.text, twiceSlots: r.twiceSlots, topics: r.topics }))
const ok =
  r.topics >= 6 &&
  !(r.firstSchedule?.slots?.length || r.firstSchedule?.everyDays) &&
  r.firstQuestion?.options?.length >= 2 &&
  r.slots?.map((s) => s.day + (s.time ?? '')).sort().join() === 'Fri19:00,Tue19:00' &&
  !!r.startDate &&
  r.keptIds === r.topics &&
  r.newDocChanged === false && r.newDocSamePlan && r.newDocQuestion?.options?.length >= 2 &&
  r.twiceSlots?.map((s) => s.day + s.time).sort().join() === 'Sat10:00,Sat15:00'
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
