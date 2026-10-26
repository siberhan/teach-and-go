// Wrapper around the FLAC Web Worker in public/flac/.
let worker: Worker | null = null
let nextId = 0
const waiting = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>()

function getWorker() {
  if (!worker) {
    worker = new Worker(`${import.meta.env.BASE_URL}flac/flac-worker.js`)
    worker.onmessage = (e) => {
      const { id, blob, error } = e.data
      const w = waiting.get(id)
      waiting.delete(id)
      if (error) w?.reject(new Error(error))
      else w?.resolve(blob)
    }
  }
  return worker
}

export function encodeFlac(pcm: Float32Array, sampleRate: number): Promise<Blob> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    getWorker().postMessage({ id, pcm, sampleRate })
  })
}
