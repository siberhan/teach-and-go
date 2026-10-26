import { encodeFlac } from './flac.ts'

export const SAMPLE_RATE = 16000
const PART_SEC = 5 * 60 // short parts keep each speech-to-text request well under the provider's time limit
const OVERLAP_SEC = 3

// Encodes the lesson as overlapping FLAC parts of a few minutes each, so no words are lost at the cuts.
export async function toFlacParts(pcm: Float32Array): Promise<Blob[]> {
  if (pcm.length <= (PART_SEC + 30) * SAMPLE_RATE) return [await encodeFlac(pcm, SAMPLE_RATE)]

  const step = PART_SEC * SAMPLE_RATE
  const overlap = OVERLAP_SEC * SAMPLE_RATE
  const parts: Blob[] = []
  for (let start = 0; start < pcm.length; start += step) {
    parts.push(await encodeFlac(pcm.subarray(Math.max(0, start - overlap), start + step), SAMPLE_RATE))
  }
  return parts
}
