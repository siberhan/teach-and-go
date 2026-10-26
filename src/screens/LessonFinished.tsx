import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import RetryButton from '../components/RetryButton.tsx'
import { db } from '../lib/db.ts'
import { duration } from '../lib/format.ts'

export default function LessonFinished() {
  const { lessonId = '' } = useParams()
  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId])
  if (!lesson) return <main className="screen" />

  return (
    <main className="screen">
      <div className="hero">
        <div className="done-mark">✓</div>
        <h1>Lesson complete</h1>
        <p className="muted">{duration(lesson.durationSec)}</p>
        {lesson.status === 'analyzing' && <p className="analyzing"><span className="spinner" /> Analyzing in the background</p>}
        {lesson.status === 'done' && <p>Saved to memory. Audio deleted.</p>}
        {lesson.status === 'failed' && <p className="error">{lesson.error}</p>}
        {lesson.status === 'failed' && <RetryButton lessonId={lesson.id} />}
      </div>
      <Link className="btn btn-primary" to={`/space/${lesson.spaceId}`}>
        {lesson.status === 'analyzing' ? 'Leave — it keeps going' : 'Back to space'}
      </Link>
    </main>
  )
}
