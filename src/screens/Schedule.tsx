import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { ScheduleLine } from '../components/PlanView.tsx'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { scheduleOf, scheduleRows } from '../lib/schedule.ts'
import { dayLabel, progressIndex } from '../lib/thread.ts'

// When each topic will be taught: dates from the curriculum, or worked out from the teacher's routine.
export default function Schedule() {
  const { id = '' } = useParams()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const lessons = useLiveQuery(() => db.lessons.where('spaceId').equals(id).toArray(), [id])
  if (!space || !lessons) return <main className="screen" />
  const plan = space.plan

  if (!plan) {
    return (
      <main className="screen">
        <TopBar title="Schedule" back={`/space/${id}`} />
        <p className="intro">No plan yet.</p>
        <Link className="btn btn-primary" to={`/space/${id}/settings`}>Set up the plan</Link>
      </main>
    )
  }

  const rows = scheduleRows(plan, progressIndex(plan, lessons))
  const hasRoutine = !!scheduleOf(plan)
  const anyEstimated = rows.some((r) => r.estimated)

  return (
    <main className="screen">
      <TopBar title="Schedule" back={`/space/${id}`} />
      <section className="card stack-sm">
        <div className="label">Routine</div>
        <ScheduleLine plan={plan} />
        {!hasRoutine && (
          <p className="muted small">
            Tell the plan your routine to see dates — <Link className="link" to={`/space/${id}/settings`}>set it</Link>.
          </p>
        )}
      </section>
      <ol className="timeline">
        {rows.map((r) => (
          <li key={r.topic.id} className={r.state}>
            <span className="timeline-when">
              {r.state === 'done' ? 'Done' : r.when ? dayLabel(r.when.date) : '—'}
              {r.state !== 'done' && r.when?.time && <span className="muted"> {r.when.time}</span>}
            </span>
            <span className="timeline-topic">
              {r.topic.title}
              {r.topic.lessons && r.topic.lessons > 1 && <span className="muted"> · {r.topic.lessons} lessons</span>}
              {r.estimated && <span className="muted small"> · estimated</span>}
            </span>
          </li>
        ))}
      </ol>
      {anyEstimated && <p className="muted small">Estimated dates assume one lesson per topic unless the plan says otherwise.</p>}
    </main>
  )
}
