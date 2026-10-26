// Slice 3 check: real Gemini call turns the demo curriculum into a plan, and a correction changes it.
import { readFileSync } from 'node:fs'
import { buildPlan, revisePlan } from '../src/lib/gemini.ts'
import { loadEnv } from './env.mjs'

const { GEMINI_KEY } = loadEnv()
const pdf = new Blob([readFileSync('demo/curriculum.pdf')])
const draft = await buildPlan(GEMINI_KEY, [{ name: 'curriculum.pdf', mimeType: 'application/pdf', data: pdf }], '')
console.log(JSON.stringify(draft, null, 1))
const ok1 = draft.plan.topics.length >= 6 && draft.plan.topics.every((t) => t.id && t.title)
const revised = await revisePlan(GEMINI_KEY, draft.plan, 'Lessons are on Tuesday and Friday.')
console.log('revised lessonDays:', revised.plan.lessonDays, 'topics kept ids:', revised.plan.topics.filter((t) => draft.plan.topics.some((o) => o.id === t.id)).length)
const ok2 = revised.plan.lessonDays?.includes('Tue') && revised.plan.lessonDays?.includes('Fri')
console.log(ok1 && ok2 ? 'PASS' : 'FAIL')
process.exit(ok1 && ok2 ? 0 : 1)
