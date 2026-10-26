import { encodeFlac } from './flac.ts'

export const SAMPLE_RATE = 16000
const MAX_PART_BYTES = 24 * 1024 * 1024 // Groq free tier allows 25 MB per file
const OVERLAP_SEC = 5

// Encodes the whole lesson; if the FLAC is too big for Groq, re-encodes it as
// overlapping parts so no words are lost at the cuts.
export async function toFlacParts(pcm: Float32Array): Promise<Blob[]> {
  const whole = await encodeFlac(pcm, SAMPLE_RATE)
  if (whole.size <= MAX_PART_BYTES) return [whole]

  const count = Math.ceil(whole.size / (MAX_PART_BYTES * 0.9))
  const step = Math.ceil(pcm.length / count)
  const overlap = OVERLAP_SEC * SAMPLE_RATE
  const parts: Blob[] = []
  for (let start = 0; start < pcm.length; start += step) {
    parts.push(await encodeFlac(pcm.subarray(Math.max(0, start - overlap), start + step), SAMPLE_RATE))
  }
  return parts
}
