import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { duration, shortDate } from '../lib/format.ts'

export default function LessonDetail() {
  const { lessonId = '' } = useParams()
  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId])
  if (!lesson) return <main className="screen" />

  return (
    <main className="screen">
      <TopBar title={shortDate(lesson.createdAt)} back={`/space/${lesson.spaceId}`} />
      <p className="muted">{duration(lesson.durationSec)}</p>
      {lesson.status === 'analyzing' && <p className="analyzing"><span className="spinner" /> Analyzing…</p>}
      {lesson.status === 'failed' && <p className="error">{lesson.error}</p>}
      {lesson.status === 'done' && (
        <>
          <section className="card stack-sm">
            <div className="label">Stopped at</div>
            <p className="plan-summary">{lesson.stoppingPoint?.text}</p>
          </section>
          <section className="stack-sm">
            <div className="label">Covered</div>
            <div className="chips">{lesson.covered?.map((c) => <span key={c} className="chip">{c}</span>)}</div>
          </section>
          {!!lesson.deferred?.length && (
            <section className="stack-sm">
              <div className="label">Explain later</div>
              {lesson.deferred.map((d) => (
                <p key={d.id} className="remind">{d.text}{d.resolved ? ' · done' : ''}</p>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}
