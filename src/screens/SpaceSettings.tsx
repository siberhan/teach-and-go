import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Composer from '../components/Composer.tsx'
import TopBar from '../components/TopBar.tsx'
import { db, type Plan } from '../lib/db.ts'
import { buildPlan, revisePlan, type PlanDraft } from '../lib/gemini.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function PlanTopics({ plan }: { plan: Plan }) {
  return (
    <ol className="topics">
      {plan.topics.map((t) => (
        <li key={t.id}>
          {t.title}
          {t.date && <span className="muted"> · {t.date}</span>}
        </li>
      ))}
    </ol>
  )
}

export default function SpaceSettings() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(task: (geminiKey: string) => Promise<PlanDraft>) {
    setError('')
    setBusy(true)
    try {
      const keys = await requireKeys()
      setDraft(await task(keys.geminiKey))
      setCorrecting(false)
    } catch (e) {
      if (e instanceof MissingKeysError) return navigate('/settings', { state: { notice: e.message } })
      console.warn(e)
      setError('Could not read that. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function send(files: File[], text: string) {
    if (draft && correcting) return run((key) => revisePlan(key, draft.plan, text))
    if (space?.plan && !draft && !files.length) return run((key) => revisePlan(key, space.plan!, text))
    await run((key) => buildPlan(key, files.map((f) => ({ name: f.name, mimeType: f.type, data: f })), text))
  }

  async function confirm() {
    if (!draft) return
    await db.spaces.update(id, { plan: draft.plan })
    setDraft(null)
    navigate(`/space/${id}`)
  }

  function toggleDay(day: string) {
    if (!draft) return
    const days = draft.plan.lessonDays ?? []
    const lessonDays = days.includes(day) ? days.filter((d) => d !== day) : DAYS.filter((d) => d === day || days.includes(d))
    setDraft({ ...draft, plan: { ...draft.plan, lessonDays } })
  }

  if (!space) return <main className="screen" />
  const needsDays = draft && !draft.plan.topics.some((t) => t.date)

  return (
    <main className="screen">
      <TopBar title={space.name} back={`/space/${id}`} />

      {draft ? (
        <section className="card stack plan-card">
          <div className="label">{draft.madeByAi ? 'I made a plan' : 'Is this your plan?'}</div>
          <p className="plan-summary">{draft.plan.summary}</p>
          <PlanTopics plan={draft.plan} />
          {draft.question && <p className="remind">{draft.question}</p>}
          {needsDays && (
            <div className="stack-sm">
              <div className="label">Lesson days</div>
              <div className="days">
                {DAYS.map((d) => (
                  <button key={d} type="button" className={`day ${draft.plan.lessonDays?.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!correcting && (
            <div className="row-actions">
              <button className="btn btn-soft" onClick={() => setCorrecting(true)}>Correct</button>
              <button className="btn btn-primary" onClick={confirm}>Confirm</button>
            </div>
          )}
        </section>
      ) : space.plan ? (
        <section className="card stack plan-card">
          <div className="label">Plan</div>
          <p className="plan-summary">{space.plan.summary}</p>
          {space.plan.lessonDays?.length ? <p className="muted">{space.plan.lessonDays.join(' · ')}</p> : null}
          <PlanTopics plan={space.plan} />
        </section>
      ) : (
        <p className="intro">Send your curriculum, a photo of it, or a short note.</p>
      )}

      {error && <p className="error">{error}</p>}

      {(!draft || correcting) && (
        <Composer
          busy={busy}
          allowFiles={!correcting}
          placeholder={correcting ? 'What should change?' : space.plan ? 'Change the plan, or send a new curriculum' : 'e.g. "Lessons on Mon and Thu, we stopped at limits"'}
          onSend={send}
        />
      )}
    </main>
  )
}
