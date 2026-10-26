import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startRecording, type Recording } from '../lib/audio/recorder.ts'
import { dictate } from '../lib/dictation.ts'
import { checkDocument } from '../lib/documents.ts'
import { MissingKeysError, requireKeys } from '../lib/settings.ts'
import MicIcon from './MicIcon.tsx'

// One composer for documents, screenshots, photos and text. Not a chat.
export default function Composer({
  placeholder,
  busy,
  allowFiles = true,
  onSend,
}: {
  placeholder: string
  busy: boolean
  allowFiles?: boolean
  onSend: (files: File[], text: string) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const recording = useRef<Recording | null>(null)
  const [mic, setMic] = useState<'idle' | 'listening' | 'writing'>('idle')

  useEffect(() => () => recording.current?.cancel(), [])

  // Dictation: speak, then the words are added to the text box (not sent yet).
  async function toggleMic() {
    setError('')
    try {
      if (mic === 'idle') {
        await requireKeys()
        recording.current = await startRecording()
        setMic('listening')
      } else if (mic === 'listening' && recording.current) {
        const pcm = await recording.current.stop()
        recording.current = null
        setMic('writing')
        const words = await dictate(pcm)
        setText((old) => (old ? old.trimEnd() + ' ' : '') + words)
        setMic('idle')
      }
    } catch (e) {
      recording.current?.cancel()
      recording.current = null
      setMic('idle')
      if (e instanceof MissingKeysError) return navigate('/settings', { state: { notice: e.message } })
      console.warn(e)
      setError('Could not turn speech into text. Try again.')
    }
  }

  async function pick(list: FileList | null) {
    // Copy first: the FileList is emptied when the input is reset below.
    const picked = Array.from(list ?? [])
    if (input.current) input.current.value = ''
    setError('')
    for (const f of picked) {
      const problem = await checkDocument(f)
      if (problem) return setError(problem)
    }
    setFiles((old) => [...old, ...picked])
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (busy || (!files.length && !text.trim())) return
    onSend(files, text.trim())
    setFiles([])
    setText('')
  }

  return (
    <form className="composer" onSubmit={send}>
      {files.length > 0 && (
        <div className="chips">
          {files.map((f, i) => (
            <button type="button" key={i} className="chip" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
              {f.name} ✕
            </button>
          ))}
        </div>
      )}
      <textarea
        rows={3}
        placeholder={mic === 'listening' ? 'Listening… tap the mic again when done' : mic === 'writing' ? 'Writing down what you said…' : placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <div className="composer-actions">
        {allowFiles && (
          <>
            <input ref={input} type="file" hidden multiple accept="application/pdf,image/*" onChange={(e) => pick(e.target.files)} />
            <button type="button" className="btn btn-soft" onClick={() => input.current?.click()}>Attach</button>
          </>
        )}
        <button
          type="button"
          className={`btn btn-soft mic ${mic === 'listening' ? 'live' : ''}`}
          aria-label={mic === 'listening' ? 'Stop dictation' : 'Dictate'}
          disabled={mic === 'writing'}
          onClick={toggleMic}
        >
          {mic === 'writing' ? <span className="spinner" /> : <MicIcon />}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || mic !== 'idle' || (!files.length && !text.trim())}>
          {busy ? 'Reading…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
