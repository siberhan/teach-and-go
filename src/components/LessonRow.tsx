import { Link } from 'react-router-dom'
import type { Lesson } from '../lib/db.ts'
import { shortDate } from '../lib/format.ts'

export default function LessonRow({ lesson }: { lesson: Lesson }) {
  return (
    <Link className="row row-link" to={`/lesson/${lesson.id}`}>
      <span className="row-main">
        {lesson.status === 'analyzing' ? (
          <span className="analyzing"><span className="spinner" /> Analyzing…</span>
        ) : lesson.status === 'failed' ? (
          <span className="error">Not analyzed · Retry</span>
        ) : (
          lesson.covered?.slice(0, 2).join(', ') || 'Lesson'
        )}
      </span>
      <span className="muted">{shortDate(lesson.createdAt)}</span>
    </Link>
  )
}
