import { Link } from 'react-router-dom'

export default function Start() {
  return (
    <main className="screen">
      <div className="notices" />
      <div className="hero">
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
