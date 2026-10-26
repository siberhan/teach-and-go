import { Link } from 'react-router-dom'
import AssistantButton from '../components/AssistantButton.tsx'
import Notifications from '../components/Notifications.tsx'

export default function Start() {
  return (
    <main className="screen">
      <div className="start-top">
        <AssistantButton />
        <Notifications />
      </div>
      <div className="hero">
        <img className="hero-logo" src="./logo-mark.png" alt="" />
        <h1 className="logo">Teach&amp;Go</h1>
        <p className="muted">Teach and go. We keep the thread.</p>
      </div>
      <Link className="btn btn-primary btn-big" to="/spaces">
        Start
      </Link>
      <Link className="btn btn-ghost" to="/settings">
        Settings
      </Link>
    </main>
  )
}
