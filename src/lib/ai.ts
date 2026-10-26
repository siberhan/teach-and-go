import { askJson, type Attachment } from './openrouter.ts'
import type { Deferred, Lesson, Plan } from './db.ts'
import { scheduleOf } from './schedule.ts'

// The app's AI tasks: prompts and JSON schemas. Plain requests through OpenRouter, no agent framework.
export type { Attachment }

export interface Question {
  text: string
  options: string[] // 2–4 short answers the teacher can tap; they can also write their own
}

export interface PlanDraft {
  plan: Plan
  madeByAi: boolean // true when the teacher's input had no topic list and the AI proposed one
  changed: boolean // false when the AI only asks and leaves the current plan as it was
  question?: Question // at most one, when something important is unknown
}

const scheduleSchema = {
  type: 'object',
  description: "The teacher's lesson routine. Only what the teacher or the source states; leave unknown parts out.",
  properties: {
    slots: {
      type: 'array',
      description: 'Weekly lessons. Two lessons on one day = two slots.',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          time: { type: 'string', description: '24h HH:MM only, only if stated.' },
        },
        required: ['day'],
      },
    },
    everyDays: { type: 'integer', description: 'For "every day" (1) or "every N days" routines instead of weekly slots.' },
    times: { type: 'array', items: { type: 'string' }, description: '24h HH:MM times for everyDays routines, only if stated.' },
    startDate: { type: 'string', description: 'Just the date as YYYY-MM-DD, nothing else, only if stated.' },
  },
}

const planSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One short sentence: subject, level, number of topics.' },
    schedule: scheduleSchema,
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A few words.' },
          date: { type: 'string', description: 'YYYY-MM-DD, only if the source gives a date.' },
          lessons: { type: 'integer', description: 'How many lessons this topic takes, only if stated.' },
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
    changed: { type: 'boolean' },
    question: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        options: { type: 'array', items: { type: 'string', description: 'A few words.' } },
      },
      required: ['text', 'options'],
    },
  },
  required: ['plan', 'madeByAi', 'changed'],
}

const today = () => new Date().toISOString().slice(0, 10)
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

const planForAi = (plan: Plan) => ({
  summary: plan.summary,
  schedule: plan.schedule ?? (plan.lessonDays?.length ? { slots: plan.lessonDays.map((day) => ({ day })) } : undefined),
  topics: plan.topics.map(({ title, date, lessons }) => ({ title, date, lessons })),
})

const ROUTINE_QUESTION: Question = {
  text: 'How often do you have lessons, and when?',
  options: ['Every day', 'Twice a week (Mon and Thu)', 'Once a week (Saturday)', 'Every 2 days'],
}

export interface PlanTurn {
  plan?: Plan // the current plan or draft, if there is one
  taught: string[] // titles of topics already taught; never removed or renamed
  files: Attachment[]
  message: string // what the teacher wrote or said, or the option they tapped
  asked?: Question // the question this message answers
}

// One request per teacher message: build, change or ask. No conversation history beyond the last question.
export async function planTurn(key: string, turn: PlanTurn): Promise<PlanDraft> {
  const now = new Date()
  const prompt = `You keep the lesson plan for one student or class of a tutor. Today is ${today()} (${WEEKDAYS_LONG[now.getDay()]}).
Return the full plan.

Rules:
- Topics: an ordered list, a few words each. If there is no topic list anywhere, propose a short sensible one and set madeByAi to true.
- Schedule is the teacher's routine. NEVER guess it — tutors teach every day, every few days, on some weekdays, sometimes twice a day, mornings or evenings. Fill only what the source or the teacher states; leave the rest out.
- Topic dates: only if the source gives them. "lessons" on a topic: only if stated.
- Never remove or rename topics that were already taught.
- Ask at most ONE question, with 2 to 4 short answer options the teacher can tap. Ask only the first that applies:
  1. Only if a current plan exists (not "(none yet)"): a new document came with that plan in place and no clear instruction what to do with it → do NOT change the plan (changed=false, return it as it is) and ask what to do with it. Options like: add its topics after the current ones / replace the topics not taught yet / only add detail to existing topics.
  2. The schedule is still unknown → ask about the routine (how often, which days, what time, from when). Options should be common routines that fit the material, phrased as answers.
  Otherwise ask nothing.
- changed = true if the returned plan differs from the current plan.
- Write in English. Only if the teacher's message is clearly in another language, write the question and options in that language.

Current plan: ${turn.plan ? JSON.stringify(planForAi(turn.plan)) : '(none yet)'}
Already taught: ${turn.taught.length ? turn.taught.join('; ') : '(nothing yet)'}
${turn.asked ? `You asked: ${turn.asked.text}\nTeacher's answer: ${turn.message}` : `Teacher's message: ${turn.message || '(none)'}`}
${turn.files.length ? 'New document(s) attached.' : 'No new document.'}`
  const draft = await askJson<PlanDraft>(key, prompt, draftSchema, turn.files)
  const plan = !draft.changed && turn.plan ? turn.plan : withIds(draft.plan, turn.plan)
  // The routine is never guessed: if it is still unknown and the model forgot to ask, ask here.
  const question = draft.question ?? (scheduleOf(plan) || plan.topics.some((t) => t.date) ? undefined : ROUTINE_QUESTION)
  return { ...draft, madeByAi: !turn.plan && draft.madeByAi, plan, question }
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

export interface Command {
  action: 'create_space' | 'open_space' | 'start_recording' | 'rename_space' | 'delete_space' | 'edit_plan' | 'answer'
  space?: string // exact name of an existing space
  name?: string // new space name, or the new name when renaming
  copyFrom?: string // existing space whose topics a new space starts with
  change?: string // for edit_plan: what to change, in the teacher's words
  reply?: string // for answer: the reply to the teacher
}

const commandSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['create_space', 'open_space', 'start_recording', 'rename_space', 'delete_space', 'edit_plan', 'answer'] },
    space: { type: 'string' },
    name: { type: 'string' },
    copyFrom: { type: 'string' },
    change: { type: 'string' },
    reply: { type: 'string' },
  },
  required: ['action'],
}

export interface Turn {
  who: 'teacher' | 'assistant'
  text: string
}

// The assistant: each message → one app action or a short answer. The app asks the teacher before anything changes.
// Context is small on purpose: the last few turns, what is on screen, and one line per space.
export async function understandCommand(key: string, said: string, ctx: { history: Turn[]; screen: string; spaces: string[] }): Promise<Command> {
  const prompt = `You are the assistant inside Teach&Go, an app that remembers where each lesson stopped. Each student or class is a "space".
Pick ONE action for the teacher's latest message:
- create_space: name = new space name; copyFrom = an existing space whose topics it should start with, if asked.
- open_space: space.
- start_recording: start recording a lesson in space.
- rename_space: space, name = the new name.
- delete_space: space.
- edit_plan: space; change = what to change in its lesson plan or routine (topics, detail, order, lesson days and times), in the teacher's words.
- answer: anything else. reply = a short, helpful answer (1–3 sentences) using what is on screen and the spaces below — e.g. where a space stopped, what comes next. If they ask for something the app cannot do (like editing a recorded lesson's notes), say so plainly and offer the closest thing you can do. If the request is unclear, ask one short question.
space and copyFrom must be exact names from the spaces below. "this space"/"here" = the space on screen.
Reply in the teacher's language.

On screen: ${ctx.screen}
Spaces:
${ctx.spaces.join('\n') || '(none yet)'}
Conversation so far:
${ctx.history.map((t) => `${t.who}: ${t.text}`).join('\n') || '(new)'}
Teacher: ${said}`
  return askJson<Command>(key, prompt, commandSchema)
}
