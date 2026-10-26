import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db.ts'
import { dayLabel, upcomingLessons } from '../lib/thread.ts'

// A bell with a count; tapping it lists every upcoming lesson, soonest first.
export default function Notifications() {
  const upcoming = useLiveQuery(async () => upcomingLessons(await db.spaces.toArray(), await db.lessons.toArray()))
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const count = upcoming?.length ?? 0

  return (
    <div className="notif" ref={box}>
      <button className="notif-bell" aria-label="Upcoming lessons" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="notif-count">{count}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Upcoming lessons">
          <p className="label">Upcoming lessons</p>
          {count === 0 && <p className="muted">Nothing planned yet. Add lesson days in a space's plan.</p>}
          {upcoming?.map((u) => (
            <Link key={u.spaceId} className="notif-item" to={`/space/${u.spaceId}/thread`}>
              <span className="notif-day">{dayLabel(u.date)}</span>
              <span className="notif-text">
                <b>{u.spaceName}</b>
                {u.topic && <span className="muted">{u.topic}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
