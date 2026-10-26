// Preloaded by compare-models.mjs: swaps the model and adds up the cost OpenRouter reports for each call.
import { llm } from '../src/lib/openrouter.ts'

if (process.env.MODEL) llm.model = process.env.MODEL
let cost = 0
let calls = 0
const realFetch = globalThis.fetch
globalThis.fetch = async (...args) => {
  const res = await realFetch(...args)
  res.clone().json().then((d) => { cost += d.usage?.cost ?? 0; calls++ }).catch(() => {})
  return res
}
process.on('exit', () => console.log(`calls: ${calls}, cost: $${cost.toFixed(5)}`))
