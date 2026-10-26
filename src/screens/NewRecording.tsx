import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { startLessonFromFile, startLessonFromPcm } from '../lib/analysis.ts'
import { db } from '../lib/db.ts'
import { clock } from '../lib/format.ts'
import { discardLive, pauseLive, resumeLive, startLive, stopLive, useLiveRecording } from '../lib/liveRecording.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'

// The recording itself lives in liveRecording.ts, so leaving this screen keeps it running.
export default function NewRecording() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const live = useLiveRecording()
  const otherSpace = useLiveQuery(() => (live && live.spaceId !== id ? db.spaces.get(live.spaceId) : undefined), [live?.spaceId, id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function guard(task: () => Promise<void>, failMessage: string) {
    setError('')
    try {
      await requireKeys()
      await task()
    } catch (e) {
      if (e instanceof MissingKeysError) return navigate('/settings', { state: { notice: e.message } })
      console.warn(e)
      setError(failMessage)
      setBusy(false)
    }
  }

  const record = () => guard(() => startLive(id), 'Could not use the microphone. Check the browser permission.')

  const stop = () =>
    guard(async () => {
      setBusy(true)
      const pcm = await stopLive()
      const lesson = await startLessonFromPcm(id, pcm)
      navigate(`/lesson/${lesson.id}/finished`, { replace: true })
    }, 'Could not save the recording.')

  const upload = (file?: File) =>
    file &&
    guard(async () => {
      setBusy(true)
      const lesson = await startLessonFromFile(id, file)
      navigate(`/lesson/${lesson.id}/finished`, { replace: true })
    }, 'Could not read this audio file.')

  function discard() {
    if (confirm('Delete this recording? It will not be saved.')) discardLive()
  }

  if (live && live.spaceId !== id) {
    return (
      <main className="screen">
        <TopBar title="New recording" back={`/space/${id}`} />
        <div className="hero">
          <p>Another recording is running{otherSpace && <> for <b>{otherSpace.name}</b></>}.</p>
          <p className="muted">Finish it before starting a new one.</p>
          <Link className="btn btn-primary" to={`/space/${live.spaceId}/record`}>Back to recording</Link>
        </div>
      </main>
    )
  }

  const running = !!live
  const status = busy ? 'Saving…' : !live ? 'Tap to record' : live.paused ? 'Paused · tap Resume to go on' : 'Recording · tap to stop'

  return (
    <main className="screen">
      <TopBar title="New recording" back={`/space/${id}`} />
      <div className="hero">
        <div className="timer">{clock(live?.seconds ?? 0)}</div>
        <button
          className={`rec ${live && !live.paused ? 'live' : ''} ${running ? 'stop' : ''}`}
          aria-label={running ? 'Stop' : 'Record'}
          disabled={busy}
          onClick={running ? stop : record}
        >
          <span />
        </button>
        <p className="muted">{status}</p>
        {running && !busy && (
          <div className="rec-actions">
            {live.paused ? (
              <button className="btn btn-primary" onClick={() => void resumeLive()}>Resume</button>
            ) : (
              <button className="btn btn-soft" onClick={() => void pauseLive()}>Pause</button>
            )}
            <button className="btn btn-ghost" onClick={discard}>Discard</button>
          </div>
        )}
        {running && <p className="muted small">You can leave this screen — the recording keeps going.</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <input ref={input} type="file" hidden accept="audio/*" onChange={(e) => upload(e.target.files?.[0])} />
      {!running && (
        <button className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
          Upload audio file
        </button>
      )}
    </main>
  )
}
