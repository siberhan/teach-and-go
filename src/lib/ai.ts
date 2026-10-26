import { askJson, type Attachment } from './openrouter.ts'
import type { Deferred, Lesson, Plan } from './db.ts'

// Lesson analysis: one request with a strict JSON schema. Planning and the assistant are the small agent in agent.ts.
export type { Attachment }

export const today = () => new Date().toISOString().slice(0, 10)
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Topic ids are assigned here, not by the model, so they are stable and unique.
export function withIds(plan: Plan, old?: Plan): Plan {
  return {
    ...plan,
    topics: plan.topics.map((t, i) => ({
      ...t,
      id: old?.topics.find((o) => o.title === t.title)?.id ?? `t${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
    })),
  }
}

export interface LessonMemory {
  covered: string[]
  stoppingPoint: { text: string; topicId?: string; topicFinished: boolean }
  deferred: { text: string; topicId?: string }[]
  resolvedDeferredIds: string[]
}

const memorySchema = {
  type: 'object',
  properties: {
    covered: { type: 'array', items: { type: 'string', description: 'A few words each.' } },
    stoppingPoint: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Where the lesson stopped, one short phrase.' },
        topicId: { type: 'string', description: 'id of the plan topic the lesson stopped in.' },
        topicFinished: { type: 'boolean', description: 'true if that topic was fully finished.' },
      },
      required: ['text', 'topicFinished'],
    },
    deferred: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The postponed subject, a few words.' },
          topicId: { type: 'string', description: 'id of the plan topic where it belongs.' },
        },
        required: ['text'],
      },
    },
    resolvedDeferredIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['covered', 'stoppingPoint', 'deferred', 'resolvedDeferredIds'],
}

export async function analyzeLesson(
  key: string,
  plan: Plan | undefined,
  lastStop: Lesson['stoppingPoint'],
  openDeferred: Deferred[],
  transcript: string,
): Promise<LessonMemory> {
  const prompt = `You read the transcript of one tutoring lesson and write the lesson memory. Be very short.
- covered: the topics actually taught, a few words each.
- stoppingPoint: where the lesson stopped. topicId = the plan topic it stopped in; topicFinished = true only if that whole topic was finished.
- deferred: every subject the teacher explicitly postponed ("I'll explain this later", "we'll come back to this"). Link each to the plan topic where it belongs (topicId), if any.
- resolvedDeferredIds: ids of the open deferred items below that were actually explained in this lesson.
Use only ids from the lists below.

Plan topics: ${JSON.stringify(plan?.topics.map(({ id, title }) => ({ id, title })) ?? [])}
Previous stopping point: ${lastStop ? JSON.stringify(lastStop) : '(first lesson)'}
Open deferred items: ${JSON.stringify(openDeferred.map(({ id, text }) => ({ id, text })))}

Transcript:
${transcript}`
  return askJson<LessonMemory>(key, prompt, memorySchema)
}
