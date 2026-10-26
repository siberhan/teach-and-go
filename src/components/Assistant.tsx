import type { ModelMessage } from 'ai'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { startRecording, type Recording } from '../lib/audio/recorder.ts'
import { closeAssistant, useAssistantOpen } from '../lib/assistantStore.ts'
import { deleteSpace, runAgent, type PendingDelete, type Turn } from '../lib/agent.ts'
import { db, type Lesson } from '../lib/db.ts'
import { dictate } from '../lib/dictation.ts'
import { startLive } from '../lib/liveRecording.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'
import { shortDate } from '../lib/format.ts'
import MicIcon from './MicIcon.tsx'

// A conversation with the agent: speak or type → it uses the app's tools and answers in the teacher's language.
// Changes apply right away and are listed under the reply; deleting waits for a tap. The teacher closes the panel when done.

type Mic = 'idle' | 'listening' | 'thinking'

export default function Assistant() {
  const open = useAssistantOpen()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const spaces = useLiveQuery(() => db.spaces.toArray()) ?? []
  const lessons = useLiveQuery(() => db.lessons.toArray()) ?? []
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState<PendingDelete | null>(null)
  const history = useRef<ModelMessage[]>([])
  const [mic, setMic] = useState<Mic>('idle')
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false) // voice first; the text field opens on request
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
    history.current = []
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

  // What the teacher is looking at, so "here" and "this space" make sense to the agent.
  function screen() {
    const lessonId = pathname.match(/^\/lesson\/([^/]+)/)?.[1]
    const spaceId = pathname.match(/^\/space\/([^/]+)/)?.[1]
    const lesson: Lesson | undefined = lessons.find((l) => l.id === lessonId)
    const onSpace = spaces.find((s) => s.id === (lesson?.spaceId ?? spaceId))
    if (lesson && onSpace) return `A recorded lesson of ${onSpace.name} from ${shortDate(lesson.createdAt)}: stopped at "${lesson.stoppingPoint?.text ?? '-'}", covered: ${lesson.covered?.join(', ') || '-'}`
    if (onSpace) return `The space ${onSpace.name}${pathname.endsWith('/schedule') ? ' (its schedule)' : pathname.endsWith('/settings') ? ' (its plan)' : ''}`
    return 'Start or spaces list'
  }

  async function handle(text: string) {
    say('teacher', text)
    const keys = await requireKeys()
    const reply = await runAgent(keys.openrouterKey, history.current, text, {
      screen: screen(),
      navigate,
      startRecording: startLive,
    })
    history.current = reply.messages
    setMic('idle')
    setTurns((t) => [...t, { who: 'assistant', text: reply.text, actions: reply.actions }])
    if (reply.pendingDelete) setPending(reply.pendingDelete)
    // Close so the assistant's mic and panel stay out of the lesson.
    if (reply.recordingStarted) setTimeout(close, 1200)
  }

  async function confirmDelete(p: PendingDelete) {
    setPending(null)
    try {
      await deleteSpace(p.space)
      if (pathname.includes(p.space.id)) navigate('/spaces')
      history.current = [...history.current, { role: 'user', content: `[app] The teacher confirmed: "${p.space.name}" was deleted.` }]
      setTurns((t) => [...t, { who: 'assistant', text: '', actions: [`🗑 ${p.space.name}`] }])
    } catch (e) {
      fail(e)
    }
  }

  function cancelDelete(p: PendingDelete) {
    setPending(null)
    history.current = [...history.current, { role: 'user', content: `[app] The teacher tapped Cancel: "${p.space.name}" was not deleted.` }]
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
            <div key={i} className={`turn ${t.who}`}>
              {t.text && <p className={`bubble ${t.who}`}>{t.text}</p>}
              {!!t.actions?.length && (
                <ul className="agent-actions" aria-label="Changes">
                  {t.actions.map((a, j) => <li key={j}>{a}</li>)}
                </ul>
              )}
            </div>
          ))}
          {pending && (
            <div className="stack-sm bubble assistant">
              <p className="plan-summary">{pending.question}</p>
              <div className="row-actions">
                <button className="btn btn-soft" onClick={() => cancelDelete(pending)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => confirmDelete(pending)}>Yes, delete</button>
              </div>
            </div>
          )}
          {mic === 'thinking' && (
            <p className="bubble assistant thinking"><span className="spinner" /> Working on it…</p>
          )}
        </div>

        {typing ? (
          <form className="assistant-input" onSubmit={submitTyped}>
            <button
              type="button"
              className="mic-round"
              aria-label="Speak"
              disabled={mic === 'thinking'}
              onClick={() => {
                setTyping(false)
                void listen()
              }}
            >
              <MicIcon />
            </button>
            <input className="input" name="command" placeholder="Type a message" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button className="send-round" type="submit" aria-label="Send" disabled={!typed.trim() || mic === 'thinking'}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </form>
        ) : (
          <div className="assistant-voice">
            <button
              type="button"
              className={`mic-big ${mic === 'listening' ? 'live' : ''}`}
              aria-label={mic === 'listening' ? 'Done speaking' : 'Speak'}
              disabled={mic === 'thinking'}
              onClick={mic === 'listening' ? finishListening : listen}
            >
              <MicIcon />
            </button>
            <p className="hint-line">
              {mic === 'listening' ? 'Listening… tap when done' : mic === 'thinking' ? 'Working on it…' : 'Tap to speak'}
              {' · '}
              <button type="button" className="link" onClick={() => { stopMic(); setTyping(true) }}>type instead</button>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
