import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'

export default function Space() {
  const { id = '' } = useParams()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const lessons = useLiveQuery(() => db.lessons.where('spaceId').equals(id).reverse().sortBy('createdAt'), [id])

  if (space === undefined) return <main className="screen" />

  return (
    <main className="screen">
      <TopBar title={space.name} back="/spaces" right={<Link className="icon-btn" aria-label="Space settings" to={`/space/${id}/settings`}>⚙</Link>} />
      <section className="thread">
        <div className="label">Start here</div>
        <p className="thread-empty">
          {space.plan ? 'Record your first lesson.' : 'Set up this space or record a first lesson.'}
        </p>
        {!space.plan && (
          <Link className="link" to={`/space/${id}/settings`}>Set up</Link>
        )}
      </section>
      <Link className="btn btn-primary" to={`/space/${id}/record`}>New recording</Link>
      <div className="list">
        {lessons?.map((l) => (
          <div key={l.id} className="row">
            <span>{l.covered?.[0] ?? 'Lesson'}</span>
            <span className="muted">{new Date(l.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
