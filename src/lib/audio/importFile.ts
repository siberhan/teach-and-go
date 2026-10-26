import { SAMPLE_RATE } from './split.ts'

// Any audio file the browser can play → 16 kHz mono PCM.
export async function fileToPcm(file: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE }) // decodeAudioData resamples to this rate
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
    const mono = new Float32Array(buffer.length)
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels
    }
    return mono
  } finally {
    await ctx.close()
  }
}
