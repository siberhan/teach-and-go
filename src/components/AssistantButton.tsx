import { openAssistant } from '../lib/assistantStore.ts'
import { useLiveRecording } from '../lib/liveRecording.ts'

// Hidden while a lesson is being recorded, so the assistant never listens to the class.
export default function AssistantButton() {
  const live = useLiveRecording()
  if (live) return null
  return (
    <button className="assistant-btn" aria-label="Assistant" onClick={openAssistant}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
    </button>
  )
}
