import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar.tsx'
import { getKeys, saveKeys } from '../lib/settings.ts'

export default function Settings() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [key, setKey] = useState('')
  const [groq, setGroq] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getKeys().then((k) => {
      setKey(k.openrouterKey)
      setGroq(k.groqKey ?? '')
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await saveKeys(key, groq)
    setSaved(true)
    setTimeout(() => navigate(-1), 600)
  }

  return (
    <main className="screen">
      <TopBar title="Settings" />
      {notice && <p className="notice-box">{notice}</p>}
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>OpenRouter key</span>
          <input name="openrouter" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-…" />
          <a className="hint" href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">Get a key</a>
        </label>
        <label className="field">
          <span>Groq key <span className="muted">(optional)</span></span>
          <input name="groq" type="password" autoComplete="off" value={groq} onChange={(e) => setGroq(e.target.value)} placeholder="gsk_…" />
          <a className="hint" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a free key</a>
        </label>
        <p className="muted small">The OpenRouter key runs everything: speech-to-text and the lesson memory. A 30-minute lesson costs about 2 cents of your OpenRouter credit. With a Groq key, speech-to-text runs on Groq's free tier instead, and falls back to OpenRouter if Groq fails.</p>
        <p className="muted small">Keys stay on this device only.</p>
        <button className="btn btn-primary" type="submit">{saved ? 'Saved' : 'Save'}</button>
      </form>
    </main>
  )
}
