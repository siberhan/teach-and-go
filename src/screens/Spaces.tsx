import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { db } from '../lib/db.ts'
import { createSpace } from '../lib/spaces.ts'

export default function Spaces() {
  const navigate = useNavigate()
  const spaces = useLiveQuery(() => db.spaces.orderBy('createdAt').reverse().toArray())
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const space = await createSpace(name)
    navigate(`/space/${space.id}`)
  }

  return (
    <main className="screen">
      <TopBar title="Spaces" back="/" />
      <p className="desktop-only empty-hint">Pick a space on the left, or create a new one.</p>
      <div className="list phone-only">
        {spaces?.map((s) => (
          <Link key={s.id} className="row row-link" to={`/space/${s.id}`}>
            <span>{s.name}</span>
            <span className="muted">›</span>
          </Link>
        ))}
      </div>
      <div className="phone-only stack">
      {naming ? (
        <form className="stack" onSubmit={create}>
          <input className="input" autoFocus name="name" placeholder="Student or class name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={!name.trim()}>Create</button>
        </form>
      ) : (
        <button className="btn btn-primary" onClick={() => setNaming(true)}>New space</button>
      )}
      </div>
    </main>
  )
}
