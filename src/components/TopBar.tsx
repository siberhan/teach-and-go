import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AssistantButton from './AssistantButton.tsx'

// rootScreen: on desktop the sidebar replaces the back arrow, so it is hidden there.
export default function TopBar({ title, back, right, rootScreen }: { title: string; back?: string; right?: ReactNode; rootScreen?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className={`topbar ${rootScreen ? 'root-screen' : ''}`}>
      <button className="icon-btn" aria-label="Back" onClick={() => (back ? navigate(back) : navigate(-1))}>
        ‹
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="icon-slot">
        <AssistantButton />
        {right}
      </div>
    </header>
  )
}
