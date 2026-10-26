import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label="Back" onClick={() => (back ? navigate(back) : navigate(-1))}>
        ‹
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="icon-slot">{right}</div>
    </header>
  )
}
