import { useRef, useState } from 'react'
import { checkDocument } from '../lib/documents.ts'

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
      <textarea rows={3} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <div className="composer-actions">
        {allowFiles && (
          <>
            <input ref={input} type="file" hidden multiple accept="application/pdf,image/*" onChange={(e) => pick(e.target.files)} />
            <button type="button" className="btn btn-soft" onClick={() => input.current?.click()}>Attach</button>
          </>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || (!files.length && !text.trim())}>
          {busy ? 'Reading…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
