import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { lastDoneLesson, nextTopic, threadCard } from '../lib/thread.ts'

export default function ThreadDetail() {
  const { id = '' } = useParams()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const lessons = useLiveQuery(() => db.lessons.where('spaceId').equals(id).toArray(), [id])
  if (!space || !lessons) return <main className="screen" />

  const card = threadCard(space.plan, lessons)
  const last = lastDoneLesson(lessons)
  const topics = space.plan?.topics ?? []
  const next = nextTopic(space.plan, last?.stoppingPoint)
  const nextIndex = next ? topics.indexOf(next) : topics.length

  return (
    <main className="screen">
      <TopBar title="The thread" back={`/space/${id}`} />
      {last && (
        <section className="card stack-sm">
          <div className="label">Last time</div>
          <p className="plan-summary">{last.stoppingPoint?.text}</p>
          <p className="muted small">{last.covered?.join(' · ')}</p>
        </section>
      )}
      {card.reminders.map((d) => (
        <p key={d.id} className="remind">Explain today: <b>{d.text}</b></p>
      ))}
      {topics.length > 0 && (
        <ol className="topics plan-progress">
          {topics.map((t, i) => (
            <li key={t.id} className={i < nextIndex ? 'past' : i === nextIndex ? 'now' : ''}>{t.title}</li>
          ))}
        </ol>
      )}
      {card.waiting.length > 0 && (
        <section className="stack-sm">
          <div className="label">Waiting for later</div>
          {card.waiting.map((d) => (
            <p key={d.id} className="row">{d.text}</p>
          ))}
        </section>
      )}
    </main>
  )
}
