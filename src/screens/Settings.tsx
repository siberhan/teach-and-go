import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { getKeys, saveKeys } from '../lib/settings.ts'

export default function Settings() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [groq, setGroq] = useState('')
  const [gemini, setGemini] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getKeys().then((k) => {
      setGroq(k.groqKey)
      setGemini(k.geminiKey)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await saveKeys(groq, gemini)
    setSaved(true)
    setTimeout(() => navigate(-1), 600)
  }

  return (
    <main className="screen">
      <TopBar title="Settings" />
      {notice && <p className="notice-box">{notice}</p>}
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>Groq key</span>
          <input name="groq" type="password" autoComplete="off" value={groq} onChange={(e) => setGroq(e.target.value)} placeholder="gsk_…" />
          <a className="hint" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a free key</a>
        </label>
        <label className="field">
          <span>Gemini key</span>
          <input name="gemini" type="password" autoComplete="off" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza…" />
          <a className="hint" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a free key</a>
        </label>
        <p className="muted small">Keys stay on this device only.</p>
        <button className="btn btn-primary" type="submit">{saved ? 'Saved' : 'Save'}</button>
      </form>
    </main>
  )
}
