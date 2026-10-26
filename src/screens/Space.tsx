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
      <TopBar title={space.name} back="/spaces" right={<Link className="icon-btn" aria-label="Space settings" to={`/space/${id}/settings`}>⚙</Link>} />
      <ThreadCard card={threadCard(space.plan, lessons)} spaceId={id} />
      <Link className="btn btn-primary" to={`/space/${id}/record`}>New recording</Link>
      <div className="list">
        {lessons.map((l) => (
          <LessonRow key={l.id} lesson={l} />
        ))}
      </div>
    </main>
  )
}
