import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { Plan } from './db.ts'

// Direct Gemini calls: JSON out, low thinking, no agent framework.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite'

export interface PlanDraft {
  plan: Plan
  madeByAi: boolean // true when the teacher's input had no topic list and the AI proposed one
  question?: string // one short question for the teacher, if something is unclear
}

const planSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One short sentence: subject, level, number of topics.' },
    lessonDays: { type: 'array', items: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] } },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A few words.' },
          date: { type: 'string', description: 'YYYY-MM-DD, only if the source gives a date.' },
        },
        required: ['title'],
      },
    },
  },
  required: ['summary', 'topics'],
}

const draftSchema = {
  type: 'object',
  properties: {
    plan: planSchema,
    madeByAi: { type: 'boolean' },
    question: { type: 'string' },
  },
  required: ['plan', 'madeByAi'],
}

export interface Attachment {
  name: string
  mimeType: string
  data: Blob
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const today = () => new Date().toISOString().slice(0, 10)

// Calls Gemini and parses JSON; retries once if the reply is not valid JSON.
async function askJson<T>(key: string, parts: object[], schema: object): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: key })
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
    try {
      return JSON.parse(res.text ?? '') as T
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

// Topic ids are assigned here, not by the model, so they are stable and unique.
function withIds(plan: Plan, old?: Plan): Plan {
  return {
    ...plan,
    topics: plan.topics.map((t, i) => ({
      ...t,
      id: old?.topics.find((o) => o.title === t.title)?.id ?? `t${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
    })),
  }
}

export async function buildPlan(key: string, files: Attachment[], text: string): Promise<PlanDraft> {
  const parts: object[] = [
    {
      text: `You help a tutor set up lessons for one student or class. Today is ${today()}.
Read the attached curriculum and/or the teacher's note and return the lesson plan as an ordered list of topics, each a few words.
If the source has dates, copy them. If it names weekly lesson days, fill lessonDays.
If there is no topic list at all, propose a short sensible one and set madeByAi to true.
Ask at most one short question, only if something important is unclear. Keep everything short.

Teacher's note: ${text || '(none)'}`,
    },
  ]
  for (const f of files) parts.push({ inlineData: { mimeType: f.mimeType, data: await toBase64(f.data) } })
  const draft = await askJson<PlanDraft>(key, parts, draftSchema)
  return { ...draft, plan: withIds(draft.plan) }
}

export async function revisePlan(key: string, plan: Plan, correction: string): Promise<PlanDraft> {
  const parts = [
    {
      text: `Here is a tutor's lesson plan as JSON. Apply the teacher's correction and return the full updated plan. Today is ${today()}.
Keep unchanged topics exactly as they are. Ask at most one short question, only if the correction is unclear.

Plan: ${JSON.stringify({ summary: plan.summary, lessonDays: plan.lessonDays, topics: plan.topics.map(({ title, date }) => ({ title, date })) })}
Correction: ${correction}`,
    },
  ]
  const draft = await askJson<PlanDraft>(key, parts, draftSchema)
  return { ...draft, madeByAi: false, plan: withIds(draft.plan, plan) }
}
