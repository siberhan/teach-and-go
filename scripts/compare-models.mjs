// Runs the plan check with each model and prints its result, time and real OpenRouter cost.
// Usage: node --experimental-strip-types scripts/compare-models.mjs model-a model-b …
import { spawnSync } from 'node:child_process'

for (const model of process.argv.slice(2)) {
  const t = Date.now()
  const r = spawnSync('node', ['--experimental-strip-types', '--import', './scripts/count-cost.mjs', 'scripts/check-plan.mjs'], { env: { ...process.env, MODEL: model }, encoding: 'utf8' })
  const out = r.stdout + r.stderr
  console.log(`\n=== ${model} — ${((Date.now() - t) / 1000).toFixed(1)} s`)
  console.log(out.trim())
}
