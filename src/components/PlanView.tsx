import type { Plan } from '../lib/db.ts'
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
