import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { startRecording, type Recording } from '../lib/audio/recorder.ts'
import { closeAssistant, useAssistantOpen } from '../lib/assistantStore.ts'
import { db, type Lesson, type Space } from '../lib/db.ts'
import { dictate } from '../lib/dictation.ts'
import { planTurn, understandCommand, type PlanDraft, type Question, type Turn } from '../lib/ai.ts'
import { startLive } from '../lib/liveRecording.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'
import { createSpace } from '../lib/spaces.ts'
import { lastDoneLesson, nextTopic, progressIndex } from '../lib/thread.ts'
import { shortDate } from '../lib/format.ts'
import MicIcon from './MicIcon.tsx'
import { PlanTopics, QuestionCard, ScheduleLine } from './PlanView.tsx'

// A short conversation: speak or type → the AI picks one action or answers → anything that changes data asks first.
// The panel stays open after each step; the teacher closes it when done.

type Pending =
  | { kind: 'confirm'; text: string; preview?: PlanDraft; done: string; run: () => Promise<void> }
  | { kind: 'question'; space: Space; question: Question; draft: PlanDraft }

type Mic = 'idle' | 'listening' | 'thinking'

export default function Assistant() {
  const open = useAssistantOpen()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const spaces = useLiveQuery(() => db.spaces.toArray()) ?? []
  const lessons = useLiveQuery(() => db.lessons.toArray()) ?? []
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const [mic, setMic] = useState<Mic>('idle')
  const [typed, setTyped] = useState('')
  const recording = useRef<Recording | null>(null)
  const log = useRef<HTMLDivElement>(null)

  const say = (who: Turn['who'], text: string) => setTurns((t) => [...t, { who, text }])

  function stopMic() {
    recording.current?.cancel()
    recording.current = null
  }

  function close() {
    stopMic()
    closeAssistant()
  }

  // A fresh conversation each time the panel opens, listening right away.
  useEffect(() => {
    if (!open) return
    setTurns([])
    setPending(null)
    setTyped('')
    void listen()
    return stopMic
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [turns, pending, mic])

  function fail(e: unknown) {
    stopMic()
    setMic('idle')
    if (e instanceof MissingKeysError) {
      close()
      navigate('/settings', { state: { notice: e.message } })
      return
    }
    console.warn(e)
    say('assistant', 'Something went wrong. Try again in a moment.')
  }

  async function listen() {
    try {
      await requireKeys()
      setPending(null)
      recording.current = await startRecording()
      setMic('listening')
    } catch (e) {
      fail(e)
    }
  }

  async function finishListening() {
    const r = recording.current
    if (!r) return
    recording.current = null
    setMic('thinking')
    try {
      const text = (await dictate(await r.stop())).trim()
      if (!text) {
        setMic('idle')
        return say('assistant', "I didn't hear anything. Tap the mic and try again.")
      }
      await handle(text)
    } catch (e) {
      fail(e)
    }
  }

  async function submitTyped(e: React.FormEvent) {
    e.preventDefault()
    const text = typed.trim()
    if (!text || mic === 'thinking') return
    stopMic()
    setTyped('')
    setPending(null)
    setMic('thinking')
    try {
      await handle(text)
    } catch (err) {
      fail(err)
    }
  }

  const byName = (name?: string) => spaces.find((s) => s.name.toLowerCase() === name?.trim().toLowerCase())

  // What the assistant knows: what is on screen and one line per space.
  function context() {
    const spaceLine = (s: Space) => {
      const mine = lessons.filter((l) => l.spaceId === s.id)
      const last = lastDoneLesson(mine)
      const next = nextTopic(s.plan, last?.stoppingPoint)
      return `- ${s.name}: ${mine.length} lessons; last stopped at: ${last?.stoppingPoint?.text ?? '-'}; next topic: ${next?.title ?? '-'}; plan: ${s.plan?.topics.map((t) => t.title).join(', ') ?? 'none'}`
    }
    const lessonId = pathname.match(/^\/lesson\/([^/]+)/)?.[1]
    const spaceId = pathname.match(/^\/space\/([^/]+)/)?.[1]
    const lesson: Lesson | undefined = lessons.find((l) => l.id === lessonId)
    const onSpace = spaces.find((s) => s.id === (lesson?.spaceId ?? spaceId))
    let screen = 'Start or spaces list'
    if (lesson && onSpace) screen = `A recorded lesson of ${onSpace.name} from ${shortDate(lesson.createdAt)}: stopped at "${lesson.stoppingPoint?.text ?? '-'}", covered: ${lesson.covered?.join(', ') || '-'}`
    else if (onSpace) screen = `The space ${onSpace.name}${pathname.endsWith('/schedule') ? ' (its schedule)' : pathname.endsWith('/settings') ? ' (its plan)' : ''}`
    return { screen, spaces: spaces.map(spaceLine), current: onSpace }
  }

  async function handle(text: string) {
    say('teacher', text)
    const keys = await requireKeys()
    const ctx = context()
    const cmd = await understandCommand(keys.openrouterKey, text, { history: turns.slice(-6), screen: ctx.screen, spaces: ctx.spaces })
    const space = byName(cmd.space) ?? (cmd.action !== 'create_space' && !cmd.space ? ctx.current : undefined)
    setMic('idle')
    const missing = () => say('assistant', cmd.space ? `I couldn't find a space called "${cmd.space}".` : 'Which space do you mean?')

    switch (cmd.action) {
      case 'open_space':
        if (!space) return missing()
        navigate(`/space/${space.id}`)
        return say('assistant', `Opened ${space.name}.`)
      case 'create_space': {
        const name = cmd.name?.trim()
        if (!name) return say('assistant', 'What should the new space be called?')
        const from = byName(cmd.copyFrom)
        return setPending({
          kind: 'confirm',
          text: from?.plan ? `Create "${name}" with ${from.name}'s topics?` : `Create a space called "${name}"?`,
          done: `Created ${name}.`,
          run: async () => {
            const created = await createSpace(name)
            // Topics only: the other space's lesson memory and routine stay with it.
            if (from?.plan) await db.spaces.update(created.id, { plan: { summary: from.plan.summary, topics: from.plan.topics.map((t) => ({ ...t, date: undefined })) } })
            navigate(`/space/${created.id}`)
          },
        })
      }
      case 'start_recording':
        if (!space) return missing()
        return setPending({
          kind: 'confirm',
          text: `Start recording a lesson for ${space.name}?`,
          done: 'Recording. I closed so I don\'t listen to the lesson.',
          run: async () => {
            navigate(`/space/${space.id}/record`)
            await startLive(space.id)
            close()
          },
        })
      case 'rename_space': {
        const name = cmd.name?.trim()
        if (!space) return missing()
        if (!name) return say('assistant', 'What should the new name be?')
        return setPending({
          kind: 'confirm',
          text: `Rename "${space.name}" to "${name}"?`,
          done: `Renamed to ${name}.`,
          run: async () => void (await db.spaces.update(space.id, { name })),
        })
      }
      case 'delete_space':
        if (!space) return missing()
        return setPending({
          kind: 'confirm',
          text: `Delete "${space.name}" and its lesson notes?`,
          done: `Deleted ${space.name}.`,
          run: async () => {
            await db.transaction('rw', db.spaces, db.lessons, db.audio, async () => {
              const ids = (await db.lessons.where('spaceId').equals(space.id).primaryKeys()) as string[]
              await db.audio.bulkDelete(ids)
              await db.lessons.bulkDelete(ids)
              await db.spaces.delete(space.id)
            })
            if (ctx.current?.id === space.id) navigate('/spaces')
          },
        })
      case 'edit_plan':
        if (!space) return missing()
        if (!space.plan) return say('assistant', `${space.name} has no plan yet. Send a curriculum in its plan screen first.`)
        setMic('thinking')
        return editPlan(space, cmd.change || text)
      default:
        return say('assistant', cmd.reply || 'I can create, open, rename or delete a space, start a recording, change a plan, or tell you where a space stopped.')
    }
  }

  async function editPlan(space: Space, message: string, asked?: Question, draft?: PlanDraft) {
    const keys = await requireKeys()
    const mine = lessons.filter((l) => l.spaceId === space.id)
    const plan = draft?.plan ?? space.plan!
    const taught = plan.topics.slice(0, progressIndex(space.plan, mine)).map((t) => t.title)
    const next = await planTurn(keys.openrouterKey, { plan, taught, files: [], message, asked })
    setMic('idle')
    if (!next.changed && next.question) return setPending({ kind: 'question', space, question: next.question, draft: next })
    if (!next.changed) return say('assistant', 'The plan already looks like that — nothing to change.')
    setPending({
      kind: 'confirm',
      text: `Save this plan for ${space.name}?`,
      preview: next,
      done: `Saved ${space.name}'s plan.`,
      run: async () => void (await db.spaces.update(space.id, { plan: { ...next.plan, lessonDays: undefined } })),
    })
  }

  async function answer(p: Extract<Pending, { kind: 'question' }>, reply: string) {
    say('teacher', reply)
    setPending(null)
    setMic('thinking')
    try {
      await editPlan(p.space, reply, p.question, p.draft)
    } catch (e) {
      fail(e)
    }
  }

  async function confirm(p: Extract<Pending, { kind: 'confirm' }>) {
    setPending(null)
    setMic('thinking')
    try {
      await p.run()
      setMic('idle')
      say('assistant', p.done + ' Anything else?')
    } catch (e) {
      fail(e)
    }
  }

  function cancel() {
    setPending(null)
    say('assistant', 'OK, nothing changed.')
  }

  if (!open) return null

  return (
    <div className="assistant-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <section className="assistant-panel" role="dialog" aria-label="Assistant">
        <div className="assistant-head">
          <span className="label">Assistant</span>
          <button className="icon-btn" aria-label="Close assistant" onClick={close}>✕</button>
        </div>

        <div className="assistant-log" ref={log}>
          {!turns.length && mic !== 'thinking' && (
            <p className="muted small">Try: “Create a space called Alex with Maya's topics” · “Where did Maya stop?” · “Lessons with Leo are on Saturdays at 10”</p>
          )}
          {turns.map((t, i) => (
            <p key={i} className={`bubble ${t.who}`}>{t.text}</p>
          ))}
          {pending?.kind === 'confirm' && (
            <div className="stack-sm bubble assistant">
              <p className="plan-summary">{pending.text}</p>
              {pending.preview && (
                <div className="assistant-preview">
                  <ScheduleLine plan={pending.preview.plan} />
                  <PlanTopics plan={pending.preview.plan} />
                </div>
              )}
              <div className="row-actions">
                <button className="btn btn-soft" onClick={cancel}>Cancel</button>
                <button className="btn btn-primary" onClick={() => confirm(pending)}>Yes, do it</button>
              </div>
            </div>
          )}
          {pending?.kind === 'question' && (
            <QuestionCard question={pending.question} busy={mic === 'thinking'} writeHint="Or say or type your own answer below." onPick={(a) => answer(pending, a)} />
          )}
          {mic === 'thinking' && (
            <p className="bubble assistant thinking"><span className="spinner" /> Working on it…</p>
          )}
        </div>

        <form className="assistant-input" onSubmit={submitTyped}>
          <button
            type="button"
            className={`mic-round ${mic === 'listening' ? 'live' : ''}`}
            aria-label={mic === 'listening' ? 'Done speaking' : 'Speak'}
            disabled={mic === 'thinking'}
            onClick={mic === 'listening' ? finishListening : listen}
          >
            <MicIcon />
          </button>
          <input
            className="input"
            name="command"
            placeholder={mic === 'listening' ? 'Listening… tap the mic when done' : 'Type a message'}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!typed.trim() || mic === 'thinking'}>Send</button>
        </form>
      </section>
    </div>
  )
}
