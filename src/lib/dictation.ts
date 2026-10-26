import { encodeFlac } from './audio/flac.ts'
import { SAMPLE_RATE } from './audio/split.ts'
import { transcribe } from './groq.ts'
import { requireKeys } from './settings.ts'

// Spoken note → text for the composer. The audio is never stored.
export async function dictate(pcm: Float32Array): Promise<string> {
  const keys = await requireKeys()
  return transcribe(keys.groqKey, await encodeFlac(pcm, SAMPLE_RATE))
}
