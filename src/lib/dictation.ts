import { encodeFlac } from './audio/flac.ts'
import { SAMPLE_RATE } from './audio/split.ts'
import { speechToText } from './speech.ts'
import { requireKeys } from './settings.ts'

// Spoken note → text for the composer. The audio is never stored.
export async function dictate(pcm: Float32Array): Promise<string> {
  const keys = await requireKeys()
  return speechToText(keys, await encodeFlac(pcm, SAMPLE_RATE))
}
