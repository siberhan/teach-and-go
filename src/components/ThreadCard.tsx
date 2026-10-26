import { Link } from 'react-router-dom'
import type { ThreadCard as Card } from '../lib/thread.ts'

export default function ThreadCard({ card, spaceId }: { card: Card; spaceId: string }) {
  if (card.kind === 'setup')
    return (
      <section className="thread">
        <div className="label">Start here</div>
        <p className="thread-empty">Set up this space or record a first lesson.</p>
        <Link className="link" to={`/space/${spaceId}/settings`}>Set up</Link>
      </section>
    )

  return (
    <Link className="thread thread-link" to={`/space/${spaceId}/thread`}>
      <div className="label">Start here</div>
      <p className="thread-stop">{card.kind === 'first' ? (card.topic?.title ?? 'First lesson') : card.startAt}</p>
      {card.kind === 'continue' && card.lastStop && card.startAt !== card.lastStop && (
        <p className="muted small">Last time: {card.lastStop}</p>
      )}
      {card.reminders.map((d) => (
        <p key={d.id} className="remind">
          You said you'd explain <b>{d.text}</b> later. It fits today.
        </p>
      ))}
    </Link>
  )
}
