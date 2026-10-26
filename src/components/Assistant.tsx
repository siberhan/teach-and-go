import { closeAssistant, useAssistantOpen } from '../lib/assistantStore.ts'
import AgentChat from './AgentChat.tsx'

// The assistant panel on every screen. A fresh conversation each time it opens, listening right away;
// the teacher closes it when done.
export default function Assistant() {
  const open = useAssistantOpen()
  if (!open) return null

  return (
    <div className="assistant-backdrop" onClick={(e) => e.target === e.currentTarget && closeAssistant()}>
      <section className="assistant-panel" role="dialog" aria-label="Assistant">
        <div className="assistant-head">
          <span className="label">Assistant</span>
          <button className="icon-btn" aria-label="Close assistant" onClick={closeAssistant}>✕</button>
        </div>
        <AgentChat
          autoListen
          onLeave={closeAssistant}
          hint="Try: “Create a space called Alex with Maya's topics” · “Where did Maya stop?” · “Lessons with Leo are on Saturdays at 10”"
        />
      </section>
    </div>
  )
}
