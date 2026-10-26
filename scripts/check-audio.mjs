// Slice 4 risk check: in the browser, demo lecture → 16 kHz mono PCM → FLAC (worker) → Groq transcript.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { loadEnv } from './env.mjs'

const { GROQ_KEY } = loadEnv()
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('pageerror', e.message))
await p.goto('http://localhost:5173/')
const audio = readFileSync('demo/lecture.m4a').toString('base64')
const out = await p.evaluate(
  async ({ audio, key }) => {
    const { fileToPcm } = await import('/src/lib/audio/importFile.ts')
    const { toFlacParts } = await import('/src/lib/audio/split.ts')
    const { transcribe } = await import('/src/lib/groq.ts')
    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
    const pcm = await fileToPcm(new Blob([bytes]))
    const parts = await toFlacParts(pcm)
    const head = new TextDecoder().decode(await parts[0].slice(0, 4).arrayBuffer())
    const text = await transcribe(key, parts[0])
    return { seconds: pcm.length / 16000, parts: parts.length, flacBytes: parts[0].size, head, text }
  },
  { audio, key: GROQ_KEY },
)
console.log(out)
await b.close()
const ok = out.head === 'fLaC' && /later/i.test(out.text) && /quotient/i.test(out.text)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
