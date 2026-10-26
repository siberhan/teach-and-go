import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, stepCountIs, tool, type ModelMessage } from 'ai'
import { z } from 'zod'
import { today, WEEKDAYS_LONG, withIds } from './ai.ts'
import { db, type Lesson, type Plan, type Schedule, type Space } from './db.ts'
import { shortDate } from './format.ts'
import { llm, type Attachment } from './openrouter.ts'
import { describeSchedule, scheduleOf } from './schedule.ts'
import { createSpace } from './spaces.ts'
import { lastDoneLesson, nextTopic, progressIndex } from './thread.ts'

// The assistant is a small agent: the model calls the app's tools, sees their results, and may call more
// (at most 8 steps per message) before it answers. Changes apply right away; only deleting waits for a tap.
// Every word the teacher reads comes from the model, so it answers in the teacher's language.

export interface Turn {
  who: 'teacher' | 'assistant'
  text: string
  actions?: string[] // what the agent changed, shown under its reply
}

export interface PendingDelete {
  spaces: Space[] // all spaces asked for in one message, confirmed with one tap
}

export interface AgentEnv {
  screen: string // what the teacher is looking at
  planOf?: Space // set on a space's plan screen: the agent only works on this plan
  currentSpaceId?: string
  navigate: (path: string) => void
  startRecording: (spaceId: string) => Promise<void>
}

export interface AgentReply {
  text: string
  actions: string[]
  messages: ModelMessage[] // the whole conversation, for the next message
  pendingDelete?: PendingDelete
  recordingStarted: boolean
}

const MAX_STEPS = 8

const scheduleInput = z.object({
  slots: z.array(z.object({ day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']), time: z.string().optional().describe('24h HH:MM, only if stated') })).optional().describe('Weekly lessons. Two lessons on one day = two slots.'),
  everyDays: z.number().int().optional().describe('For "every day" (1) or "every N days" routines instead of weekly slots.'),
  times: z.array(z.string()).optional().describe('24h HH:MM times for everyDays routines, only if stated.'),
  startDate: z.string().optional().describe('YYYY-MM-DD, only if stated.'),
})

const topicInput = z.object({
  title: z.string().describe('A few words.'),
  lessons: z.number().int().optional().describe('How many lessons the topic takes, only if stated.'),
  date: z.string().optional().describe('YYYY-MM-DD, only if stated.'),
})

const doneLessons = async (spaceId: string) => (await db.lessons.where('spaceId').equals(spaceId).toArray()).filter((l) => l.status === 'done')

function spaceLine(s: Space, lessons: Lesson[]) {
  const last = lastDoneLesson(lessons)
  return `- ${s.name}: ${lessons.length} lessons; last stopped at: ${last?.stoppingPoint?.text ?? '-'}; next topic: ${nextTopic(s.plan, last?.stoppingPoint)?.title ?? '-'}; plan: ${s.plan ? `${s.plan.topics.length} topics` : 'none'}; routine: ${describeSchedule(scheduleOf(s.plan)) ?? 'unknown'}`
}

export async function runAgent(key: string, history: ModelMessage[], said: string, env: AgentEnv, files: Attachment[] = []): Promise<AgentReply> {
  const spaces = await db.spaces.toArray()
  const lessons = await db.lessons.toArray()
  const actions: string[] = []
  let pendingDelete: PendingDelete | undefined
  let recordingStarted = false

  const find = async (name: string) => (await db.spaces.toArray()).find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
  const notFound = async (name: string) => ({ error: `No space called "${name}". Spaces: ${(await db.spaces.toArray()).map((s) => s.name).join(', ') || '(none)'}` })

  const tools = {
    read_space: tool({
      description: "A space's full plan (topics, which are taught), its routine and its recent lessons (where each stopped, what was covered, what was postponed).",
      inputSchema: z.object({ space: z.string().describe('Exact space name') }),
      execute: async ({ space }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        const mine = await doneLessons(s.id)
        const taught = progressIndex(s.plan, mine)
        return {
          name: s.name,
          routine: describeSchedule(scheduleOf(s.plan)) ?? 'unknown',
          schedule: scheduleOf(s.plan) ?? null, // as set_routine takes it
          summary: s.plan?.summary,
          topics: s.plan?.topics.map((t, i) => ({ title: t.title, lessons: t.lessons, date: t.date, taught: i < taught })) ?? 'no plan yet',
          recentLessons: mine.slice(-5).map((l) => ({ date: shortDate(l.createdAt), stoppedAt: l.stoppingPoint?.text, covered: l.covered, postponed: l.deferred?.filter((d) => !d.resolved).map((d) => d.text) })),
        }
      },
    }),
    create_space: tool({
      description: 'Create a new space (a student or class). Call it once per space when several are asked for.',
      inputSchema: z.object({ name: z.string().describe('The name the teacher said. Never make one up; if none was given, do not call this tool — ask.'), copyTopicsFrom: z.string().optional().describe('Existing space whose topics the new one starts with, only if asked') }),
      execute: async ({ name, copyTopicsFrom }) => {
        name = name.trim()
        if (!name) return { error: 'No name given. Nothing was created. Ask the teacher what the space should be called.' }
        if (await find(name)) return { error: `A space called "${name}" already exists.` }
        const from = copyTopicsFrom ? await find(copyTopicsFrom) : undefined
        if (copyTopicsFrom && !from) return notFound(copyTopicsFrom)
        const created = await createSpace(name)
        // Topics only: the other space's lesson memory and routine stay with it.
        if (from?.plan) await db.spaces.update(created.id, { plan: { summary: from.plan.summary, topics: from.plan.topics.map((t) => ({ ...t, date: undefined })) } })
        actions.push(`+ ${name}`) // the teacher stays where they are; open_space moves them
        return { created: name, topics: from?.plan?.topics.length ?? 0, routine: 'unknown' }
      },
    }),
    open_space: tool({
      description: 'Show a space on screen: its home, its schedule (when each topic is taught) or its plan screen.',
      inputSchema: z.object({ space: z.string(), screen: z.enum(['home', 'schedule', 'plan']).optional() }),
      execute: async ({ space, screen = 'home' }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        env.navigate(`/space/${s.id}${screen === 'schedule' ? '/schedule' : screen === 'plan' ? '/settings' : ''}`)
        actions.push(`→ ${s.name}`)
        return { opened: s.name, screen }
      },
    }),
    rename_space: tool({
      description: 'Rename a space.',
      inputSchema: z.object({ space: z.string(), newName: z.string() }),
      execute: async ({ space, newName }) => {
        if (!newName.trim()) return { error: 'No new name given. Ask the teacher for it.' }
        const s = await find(space)
        if (!s) return notFound(space)
        await db.spaces.update(s.id, { name: newName.trim() })
        actions.push(`${s.name} → ${newName.trim()}`)
        return { renamed: newName.trim() }
      },
    }),
    set_topics: tool({
      description: "Replace a space's topic list (also for a space with no plan yet). Send the FULL ordered list. Read the space first when it has a plan. Taught topics must stay, unchanged and first.",
      inputSchema: z.object({ space: z.string(), summary: z.string().describe('One short sentence: subject, level, number of topics.'), topics: z.array(topicInput) }),
      execute: async ({ space, summary, topics }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        const taught = s.plan?.topics.slice(0, progressIndex(s.plan, await doneLessons(s.id))) ?? []
        if (taught.some((t, i) => topics[i]?.title !== t.title)) return { error: `These taught topics must stay first, unchanged: ${taught.map((t) => t.title).join('; ')}` }
        const same = (a: { title: string; lessons?: number; date?: string }, b: typeof a) => a.title === b.title && (a.lessons ?? 1) === (b.lessons ?? 1) && a.date === b.date
        if (s.plan && s.plan.topics.length === topics.length && topics.every((t, i) => same(t, s.plan!.topics[i]))) return { unchanged: 'This is the current list; nothing was saved.' }
        const plan: Plan = withIds({ summary, schedule: scheduleOf(s.plan), topics: topics.map((t) => ({ id: '', ...t })) }, s.plan)
        await db.spaces.update(s.id, { plan })
        actions.push(`✎ ${s.name} · ${topics.length} topics`)
        return { saved: topics.length, routine: describeSchedule(plan.schedule) ?? 'unknown' }
      },
    }),
    set_routine: tool({
      description: "Set when a space's lessons happen; replaces the whole routine, so send the days and times you keep too. Only what the teacher said; never guess days or times — ask instead.",
      inputSchema: z.object({ space: z.string(), schedule: scheduleInput }),
      execute: async ({ space, schedule }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        const clean: Schedule = schedule.everyDays ? { everyDays: schedule.everyDays, times: schedule.times, startDate: schedule.startDate } : { slots: schedule.slots, startDate: schedule.startDate }
        const plan: Plan = { ...(s.plan ?? { summary: '', topics: [] }), schedule: clean, lessonDays: undefined }
        await db.spaces.update(s.id, { plan })
        const routine = describeSchedule(clean) ?? 'unknown'
        actions.push(`✎ ${s.name} · ${routine}`)
        return { routine }
      },
    }),
    start_recording: tool({
      description: 'Start recording a lesson in a space. The assistant closes so it does not listen to the lesson.',
      inputSchema: z.object({ space: z.string() }),
      execute: async ({ space }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        env.navigate(`/space/${s.id}/record`)
        await env.startRecording(s.id)
        recordingStarted = true
        actions.push(`● ${s.name}`)
        return { recording: s.name }
      },
    }),
    delete_space: tool({
      description: 'Delete a space and its lesson notes. Call once per space; nothing is deleted yet: the app shows one button to confirm them all.',
      inputSchema: z.object({ space: z.string() }),
      execute: async ({ space }) => {
        const s = await find(space)
        if (!s) return notFound(space)
        // Several delete calls in one message add up to one confirm card.
        pendingDelete = { spaces: [...(pendingDelete?.spaces.filter((x) => x.id !== s.id) ?? []), s] }
        return { waitingForTeacher: 'A confirm button is shown under your reply. Ask the teacher to confirm; do not say it is deleted.' }
      },
    }),
  }

  const now = new Date()
  const instructions = `You are the assistant inside Teach&Go, an app for tutors that remembers where each lesson stopped. Each student or class is a "space" with a plan (ordered topics + a routine) and recorded lessons.
Use the tools to do what the teacher asks — several tools in a row when needed (e.g. create two spaces, or create a space and then set its topics). Then reply in 1–3 short sentences of plain text (no Markdown).
- Never say you saved, noted or changed something unless a tool did it in this message — the app keeps nothing else. The app lists your changes under your reply, so do not repeat every detail.
- Cancelled or moved lessons ("no lesson this week, we start next week"): there is no single-lesson cancel; read the space, then call set_routine with the same days and times and startDate = the first lesson day after the break.
- Never guess a routine, a space name or which space is meant: ask one short question instead.
- "this space"/"here" = the space on screen. Use exact space names.
- To change topics of a space that has a plan, read it first, then send the full new list.
- Recorded lessons' notes cannot be edited here; say so and offer the closest thing.
Today is ${today()} (${WEEKDAYS_LONG[now.getDay()]}).
On screen: ${env.screen}
Spaces:
${spaces.map((s) => spaceLine(s, lessons.filter((l) => l.spaceId === s.id && l.status === 'done'))).join('\n') || '(none yet)'}
${env.planOf ? planRules(env.planOf.name) : ''}
The teacher's latest message is: "${said}". Your reply and any question you write in a tool must be in the language of THAT message, even if earlier messages were in another language.`

  const openrouter = createOpenRouter({ apiKey: key, headers: { 'X-Title': 'Teach&Go' } })
  // The language reminder rides on the message itself: a reminder in the instructions alone loses to a long history in another language.
  const text = `${said || '(sent a document)'}\n\n(Reply in the language of this message.)`
  const parts = await Promise.all(files.map(async (f) => ({ type: 'file' as const, data: new Uint8Array(await f.data.arrayBuffer()), mediaType: f.mimeType, filename: f.name })))
  const messages: ModelMessage[] = [...history, { role: 'user', content: parts.length ? [{ type: 'text', text }, ...parts] : text }]
  const result = await generateText({
    model: openrouter(llm.model),
    instructions,
    messages,
    tools,
    activeTools: env.planOf ? ['read_space', 'set_topics', 'set_routine'] : undefined,
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: { openrouter: { reasoning: { effort: 'none' } } },
  })
  return { text: result.text.trim(), actions, messages: [...messages, ...result.response.messages], pendingDelete, recordingStarted }
}

// On a space's plan screen the conversation sets up or changes that one plan, from documents, photos or talk.
const planRules = (name: string) => `
You are on the plan screen of the space "${name}". Set up or change its plan with the teacher:
- Topics come from attached documents or photos, or from what the teacher says. If there is no topic list anywhere, propose a short sensible one and say it is a proposal they can change.
- NEVER guess the routine — tutors teach every day, every few days, on some weekdays, twice a day, mornings or evenings. Save only what was said. While it is unknown, end your reply with one short question about it (how often, which days, what time); you may suggest 2–4 common answers in the sentence. A start date is optional: without one, lessons start from today — do not ask for it.
- A new document while "${name}" already has topics and the teacher did not say what to do with it: change nothing and ask whether to add its topics after the current ones, replace the topics not taught yet, or only add detail to existing topics.
- Read the space first when it already has a plan.`

// Deleting happens only after the teacher taps the button.
export async function deleteSpace(space: Space) {
  await db.transaction('rw', db.spaces, db.lessons, db.audio, async () => {
    const ids = (await db.lessons.where('spaceId').equals(space.id).primaryKeys()) as string[]
    await db.audio.bulkDelete(ids)
    await db.lessons.bulkDelete(ids)
    await db.spaces.delete(space.id)
  })
}
