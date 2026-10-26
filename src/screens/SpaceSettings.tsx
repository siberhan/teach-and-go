import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AgentChat from '../components/AgentChat.tsx'
import { PlanTopics, ScheduleLine } from '../components/PlanView.tsx'
import TopBar from '../components/TopBar.tsx'
import { deleteSpace } from '../lib/agent.ts'
import { db } from '../lib/db.ts'

// A space's plan, shaped in a conversation with the agent: send the curriculum or a photo, or just talk.
// The agent saves topics and routine as it goes, so the plan above always shows what is saved.
export default function SpaceSettings() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const space = useLiveQuery(() => db.spaces.get(id), [id])
  const [confirming, setConfirming] = useState(false)

  if (!space) return <main className="screen" />
  const plan = space.plan

  return (
    <main className="screen">
      <TopBar title={space.name} back={`/space/${id}`} />

      {plan ? (
        <section className="card stack plan-card">
          <div className="label">Plan</div>
          {plan.summary && <p className="plan-summary">{plan.summary}</p>}
          <ScheduleLine plan={plan} />
          <PlanTopics plan={plan} />
          <Link className="link" to={`/space/${id}/schedule`}>See the schedule</Link>
        </section>
      ) : (
        <p className="intro">Send your curriculum or a photo of it, or just tell me what you teach and when.</p>
      )}

      <section className="card plan-chat">
        <AgentChat
          key={id}
          planOf={space}
          hint={plan ? 'e.g. “Lessons are Tue and Fri at 19:00” · “Add a review topic after limits”' : 'e.g. “Primary school maths, Mondays and Thursdays at 17:00”'}
        />
      </section>

      {confirming ? (
        <section className="card stack-sm">
          <p className="plan-summary">Delete {space.name} and all its lessons?</p>
          <div className="row-actions">
            <button className="btn btn-soft" onClick={() => setConfirming(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { await deleteSpace(space); navigate('/spaces') }}>Yes, delete</button>
          </div>
        </section>
      ) : (
        <p className="hint-line"><button type="button" className="link" onClick={() => setConfirming(true)}>Delete this space</button></p>
      )}
    </main>
  )
}
