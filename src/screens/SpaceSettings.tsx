import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Composer from '../components/Composer.tsx'
import { PlanTopics, QuestionCard, ScheduleLine } from '../components/PlanView.tsx'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { planTurn, type Attachment, type PlanDraft } from '../lib/ai.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'
import { progressIndex } from '../lib/thread.ts'

const toAttachments = (files: File[]): Attachment[] => files.map((f) => ({ name: f.name, mimeType: f.type, data: f }))

export default function SpaceSettings() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const lessons = useLiveQuery(() => db.lessons.where('spaceId').equals(id).toArray(), [id])
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  // Documents from the turn that asked a question: sent again with the answer, so the AI can act on them.
  const [askedFiles, setAskedFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send(files: File[], text: string) {
    if (!space) return
    setError('')
    setBusy(true)
    try {
      const keys = await requireKeys()
      const current = draft?.plan ?? space.plan
      const taught = current ? current.topics.slice(0, progressIndex(current, lessons ?? [])).map((t) => t.title) : []
      const answering = draft?.question
      const sent = files.length ? toAttachments(files) : answering ? askedFiles : []
      const next = await planTurn(keys.openrouterKey, { plan: current, taught, files: sent, message: text, asked: answering })
      setDraft(next)
      setAskedFiles(next.question ? sent : [])
    } catch (e) {
      if (e instanceof MissingKeysError) return navigate('/settings', { state: { notice: e.message } })
      console.warn(e)
      setError('Could not read that. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!draft) return
    await db.spaces.update(id, { plan: { ...draft.plan, lessonDays: undefined } })
    setDraft(null)
    navigate(`/space/${id}`)
  }

  if (!space) return <main className="screen" />
  // Only a question, the plan itself is untouched (e.g. a new document without instructions).
  const onlyAsking = draft && !draft.changed && space.plan
  const shown = draft?.plan ?? space.plan

  return (
    <main className="screen">
      <TopBar title={space.name} back={`/space/${id}`} />

      {shown ? (
        <section className="card stack plan-card">
          <div className="label">{!draft || onlyAsking ? 'Plan' : draft.madeByAi ? 'I made a plan' : space.plan ? 'Updated plan' : 'Is this your plan?'}</div>
          <p className="plan-summary">{shown.summary}</p>
          <ScheduleLine plan={shown} />
          <PlanTopics plan={shown} />
          {space.plan && !draft && <Link className="link" to={`/space/${id}/schedule`}>See the schedule</Link>}
          {draft?.question && <QuestionCard question={draft.question} busy={busy} onPick={(a) => send([], a)} />}
          {onlyAsking && <button className="btn btn-ghost" onClick={() => setDraft(null)}>Leave the plan as it is</button>}
          {draft && !onlyAsking && (
            <div className="row-actions">
              <button className="btn btn-soft" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirm}>Confirm</button>
            </div>
          )}
        </section>
      ) : (
        <p className="intro">Send your curriculum, a photo of it, or a short note.</p>
      )}

      {error && <p className="error">{error}</p>}

      <Composer
        busy={busy}
        placeholder={
          draft?.question ? 'Your answer' : draft ? 'What should change?' : space.plan ? 'Change the plan or routine, or send a new document' : 'e.g. "Lessons on Tue and Fri at 7 pm, we stopped at limits"'
        }
        onSend={send}
      />
    </main>
  )
}
