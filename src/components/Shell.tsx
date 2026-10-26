import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { db } from '../lib/db.ts'
import { createSpace } from '../lib/spaces.ts'
import { sortSpaces } from '../lib/thread.ts'

// Desktop: a sidebar with all spaces stays open next to the current screen.
// Phone: the sidebar is hidden and every screen is full width, as before.
export default function Shell() {
  const navigate = useNavigate()
  const spaces = useLiveQuery(() => db.spaces.toArray().then((all) => sortSpaces(all)))
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const space = await createSpace(name)
    setName('')
    setNaming(false)
    navigate(`/space/${space.id}`)
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo">Teach&amp;Go</Link>
        <nav className="sidebar-list">
          {spaces?.map((s) => (
            <NavLink key={s.id} to={`/space/${s.id}`} className="sidebar-item">
              {s.name}
            </NavLink>
          ))}
        </nav>
        {naming ? (
          <form className="stack-sm" onSubmit={create}>
            <input className="input" autoFocus placeholder="Student or class name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !name && setNaming(false)} />
            <button className="btn btn-primary" type="submit" disabled={!name.trim()}>Create</button>
          </form>
        ) : (
          <button className="btn btn-primary" onClick={() => setNaming(true)}>New space</button>
        )}
        <NavLink to="/settings" className="sidebar-settings">Settings</NavLink>
      </aside>
      <div className="shell-main">
        <Outlet />
      </div>
    </div>
  )
}
