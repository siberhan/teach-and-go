import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db.ts'
import { dayLabel, upcomingLessons } from '../lib/thread.ts'

export default function Start() {
  const upcoming = useLiveQuery(async () => upcomingLessons(await db.spaces.toArray(), await db.lessons.toArray()))

  return (
    <main className="screen">
      <div className="notices">
        {upcoming?.slice(0, 3).map((u) => (
          <Link key={u.spaceId} className="notice" to={`/space/${u.spaceId}/thread`}>
            <span className="dot" />
            <span>
              {dayLabel(u.date)} · <b>{u.spaceName}</b>
              {u.topic && <span className="muted"> · {u.topic}</span>}
            </span>
          </Link>
        ))}
      </div>
      <div className="hero">
        <h1 className="logo">Teach&amp;Go</h1>
        <p className="muted">Teach and go. We keep the thread.</p>
      </div>
      <Link className="btn btn-primary btn-big" to="/spaces">
        Start
      </Link>
      <Link className="btn btn-ghost" to="/settings">
        Settings
      </Link>
    </main>
  )
}
