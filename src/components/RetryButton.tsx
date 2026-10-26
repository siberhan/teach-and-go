import { runAnalysis } from '../lib/analysis.ts'

export default function RetryButton({ lessonId }: { lessonId: string }) {
  return (
    <button className="btn btn-primary" onClick={() => runAnalysis(lessonId)}>
      Retry
    </button>
  )
}
