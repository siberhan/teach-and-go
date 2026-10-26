import type { Plan } from '../lib/db.ts'
import type { Question } from '../lib/ai.ts'
import { describeSchedule, scheduleOf } from '../lib/schedule.ts'

export function PlanTopics({ plan }: { plan: Plan }) {
  return (
    <ol className="topics">
      {plan.topics.map((t) => (
        <li key={t.id}>
          {t.title}
          {t.date && <span className="muted"> · {t.date}</span>}
          {t.lessons && t.lessons > 1 && <span className="muted"> · {t.lessons} lessons</span>}
        </li>
      ))}
    </ol>
  )
}

export function ScheduleLine({ plan }: { plan: Plan }) {
  const text = describeSchedule(scheduleOf(plan))
  return <p className={text ? 'schedule-line' : 'muted'}>{text ?? 'No routine yet'}</p>
}

// One AI question with tap-able answers; the teacher can also write their own in the composer.
export function QuestionCard({ question, busy, onPick, writeHint = 'Or write your own answer below.' }: { question: Question; busy: boolean; onPick: (answer: string) => void; writeHint?: string }) {
  return (
    <div className="question">
      <p className="question-text">{question.text}</p>
      <div className="options">
        {question.options.map((o, i) => (
          <button key={o} type="button" className="option" disabled={busy} onClick={() => onPick(o)}>
            <span className="option-key">{String.fromCharCode(65 + i)}</span>
            {o}
          </button>
        ))}
      </div>
      <p className="muted small">{writeHint}</p>
    </div>
  )
}
