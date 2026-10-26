import { SAMPLE_RATE } from './split.ts'

// Microphone → 16 kHz mono PCM, kept in memory as 16-bit chunks until stop().
// The browser resamples to 16 kHz for us when the AudioContext runs at that rate.

const workletCode = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0][0]
    if (ch) this.port.postMessage(ch.slice())
    return true
  }
}
registerProcessor('tap', Tap)
`

export interface Recording {
  seconds: () => number
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<Float32Array>
  cancel: () => void
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
  const url = URL.createObjectURL(new Blob([workletCode], { type: 'text/javascript' }))
  await ctx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)

  const source = ctx.createMediaStreamSource(stream)
  const tap = new AudioWorkletNode(ctx, 'tap')
  const chunks: Int16Array[] = []
  let samples = 0
  let paused = false
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (paused) return
    const f = e.data
    const ints = new Int16Array(f.length)
    for (let i = 0; i < f.length; i++) ints[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff
    chunks.push(ints)
    samples += ints.length
  }
  source.connect(tap)

  function close() {
    source.disconnect()
    tap.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }

  return {
    seconds: () => samples / SAMPLE_RATE,
    // Chunks still in flight when pausing are dropped, so paused time is neither stored nor counted.
    pause: () => {
      paused = true
      return ctx.suspend()
    },
    resume: async () => {
      await ctx.resume()
      paused = false
    },
    cancel: close,
    async stop() {
      close()
      const pcm = new Float32Array(samples)
      let at = 0
      for (const c of chunks) {
        for (let i = 0; i < c.length; i++) pcm[at + i] = c[i] / 0x7fff
        at += c.length
      }
      return pcm
    },
  }
}
