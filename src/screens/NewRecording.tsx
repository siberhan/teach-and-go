import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { startLessonFromFile, startLessonFromPcm } from '../lib/analysis.ts'
import { startRecording, type Recording } from '../lib/audio/recorder.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function NewRecording() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const recording = useRef<Recording | null>(null)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Tick the timer while recording; stop the microphone if the teacher leaves the screen.
  useEffect(() => {
    const t = setInterval(() => recording.current && setSeconds(recording.current.seconds()), 250)
    return () => {
      clearInterval(t)
      recording.current?.cancel()
    }
  }, [])

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
      setSeconds(null)
    }
  }

  const record = () =>
    guard(async () => {
      recording.current = await startRecording()
      setSeconds(0)
    }, 'Could not use the microphone. Check the browser permission.')

  const stop = () =>
    guard(async () => {
      setBusy(true)
      const pcm = await recording.current!.stop()
      recording.current = null
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

  const live = seconds !== null

  return (
    <main className="screen">
      <TopBar title="New recording" back={`/space/${id}`} />
      <div className="hero">
        <div className="timer">{clock(seconds ?? 0)}</div>
        <button
          className={`rec ${live ? 'live' : ''}`}
          aria-label={live ? 'Stop' : 'Record'}
          disabled={busy}
          onClick={live ? stop : record}
        >
          <span />
        </button>
        <p className="muted">{busy ? 'Saving…' : live ? 'Tap to stop' : 'Tap to record'}</p>
        {error && <p className="error">{error}</p>}
      </div>
      <input ref={input} type="file" hidden accept="audio/*" onChange={(e) => upload(e.target.files?.[0])} />
      {!live && (
        <button className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
          Upload audio file
        </button>
      )}
    </main>
  )
}
