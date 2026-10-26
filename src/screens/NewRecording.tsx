import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { startLessonFromFile } from '../lib/analysis.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'

export default function NewRecording() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(file?: File) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      await requireKeys()
      const lesson = await startLessonFromFile(id, file)
      navigate(`/lesson/${lesson.id}/finished`, { replace: true })
    } catch (e) {
      if (e instanceof MissingKeysError) return navigate('/settings', { state: { notice: e.message } })
      console.warn(e)
      setError('Could not read this audio file.')
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <TopBar title="New recording" back={`/space/${id}`} />
      <div className="hero">
        {busy ? (
          <p className="analyzing"><span className="spinner" /> Preparing audio…</p>
        ) : (
          <p className="muted">Live recording comes next.</p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <input ref={input} type="file" hidden accept="audio/*" onChange={(e) => upload(e.target.files?.[0])} />
      <button className="btn btn-soft" disabled={busy} onClick={() => input.current?.click()}>
        Upload audio file
      </button>
    </main>
  )
}
