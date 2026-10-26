import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation } from 'react-router-dom'
import { db } from '../lib/db.ts'
import { clock } from '../lib/format.ts'
import { useLiveRecording } from '../lib/liveRecording.ts'

// Shown on every screen except the recording screen while a recording is running or paused.
export default function RecordingBar() {
  const live = useLiveRecording()
  const { pathname } = useLocation()
  const space = useLiveQuery(() => (live ? db.spaces.get(live.spaceId) : undefined), [live?.spaceId])
  if (!live) return null
  const to = `/space/${live.spaceId}/record`
  if (pathname === to) return null

  return (
    <Link className={`rec-bar ${live.paused ? 'paused' : ''}`} to={to}>
      <span className="rec-bar-dot" />
      <span className="rec-bar-text">
        {live.paused ? 'Paused' : 'Recording'} · {clock(live.seconds)}
        {space && <span className="muted"> · {space.name}</span>}
      </span>
      <b>Back to recording</b>
    </Link>
  )
}
