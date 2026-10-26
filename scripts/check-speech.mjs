// Speech-to-text routing: with a Groq key → Groq; with a broken Groq key → falls back to OpenRouter; no Groq key → OpenRouter.
// Usage: node --experimental-strip-types scripts/check-speech.mjs (makes a 16 kHz FLAC of the demo lecture with ffmpeg)
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { speechToText } from '../src/lib/speech.ts'
import { loadEnv } from './env.mjs'

const { OPENROUTER_KEY, GROQ_KEY } = loadEnv()
const file = '/tmp/teach-and-go-lecture.flac'
if (!existsSync(file)) execSync(`ffmpeg -loglevel error -y -i demo/lecture.m4a -ac 1 -ar 16000 ${file}`)
const audio = new Blob([readFileSync(file)], { type: 'audio/flac' })

const used = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const res = await realFetch(url, init)
  used.push(`${new URL(url).host} ${res.status}`)
  return res
}
const r = {}
for (const [label, groqKey] of [['groq', GROQ_KEY], ['brokenGroq', 'gsk_wrong'], ['noGroq', '']]) {
  used.length = 0
  const t = Date.now()
  const text = await speechToText({ id: 'main', openrouterKey: OPENROUTER_KEY, groqKey }, audio)
  r[label] = { ms: Date.now() - t, calls: [...used], ok: /quotient/i.test(text) }
}
console.log(r)
const ok =
  r.groq.ok && r.groq.calls.join() === 'api.groq.com 200' &&
  r.brokenGroq.ok && r.brokenGroq.calls.join() === 'api.groq.com 401,openrouter.ai 200' &&
  r.noGroq.ok && r.noGroq.calls.join() === 'openrouter.ai 200'
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
