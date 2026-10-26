import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import LessonRow from '../components/LessonRow.tsx'
import ThreadCard from '../components/ThreadCard.tsx'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { threadCard } from '../lib/thread.ts'

export default function Space() {
  const { id = '' } = useParams()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const lessons = useLiveQuery(() => db.lessons.where('spaceId').equals(id).reverse().sortBy('createdAt'), [id])

  if (!space || !lessons) return <main className="screen" />

  return (
    <main className="screen">
      <TopBar rootScreen title={space.name} back="/spaces" right={<Link className="icon-btn" aria-label="Space settings" to={`/space/${id}/settings`}>⚙</Link>} />
      <div className="space-grid">
        <div className="stack">
          <ThreadCard card={threadCard(space.plan, lessons)} spaceId={id} />
          <Link className="btn btn-primary" to={`/space/${id}/record`}>New recording</Link>
          {space.plan && <Link className="btn btn-soft" to={`/space/${id}/schedule`}>Schedule</Link>}
        </div>
        <div className="list">
          <div className="label desktop-only">Lessons</div>
          {lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} />
          ))}
          {!lessons.length && <p className="empty-box desktop-only">Your lessons will appear here.</p>}
        </div>
      </div>
    </main>
  )
}
