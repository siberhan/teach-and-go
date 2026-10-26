// Classic Web Worker: encodes 16 kHz mono PCM (Float32Array) into a FLAC file.
// Uses libflac.js (MIT, https://github.com/mmig/libflac.js), copied next to this file.
self.FLAC_SCRIPT_LOCATION = './'
importScripts('libflac.min.wasm.js')

const ready = new Promise((resolve) => {
  if (Flac.isReady()) resolve()
  else Flac.on('ready', resolve)
})

function encode(pcm, sampleRate) {
  const enc = Flac.create_libflac_encoder(sampleRate, 1, 16, 5, pcm.length, false, 0)
  if (!enc) throw new Error('FLAC encoder could not start')
  const chunks = []
  if (Flac.init_encoder_stream(enc, (data) => chunks.push(data.slice())) !== 0) throw new Error('FLAC init failed')
  const STEP = sampleRate * 10 // 10 s per call keeps memory small
  for (let i = 0; i < pcm.length; i += STEP) {
    const part = pcm.subarray(i, i + STEP)
    const ints = new Int32Array(part.length)
    for (let j = 0; j < part.length; j++) ints[j] = Math.max(-1, Math.min(1, part[j])) * 0x7fff
    if (!Flac.FLAC__stream_encoder_process_interleaved(enc, ints, ints.length)) throw new Error('FLAC encode failed')
  }
  Flac.FLAC__stream_encoder_finish(enc)
  Flac.FLAC__stream_encoder_delete(enc)
  return new Blob(chunks, { type: 'audio/flac' })
}

self.onmessage = async (e) => {
  const { id, pcm, sampleRate } = e.data
  try {
    await ready
    self.postMessage({ id, blob: encode(pcm, sampleRate) })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}
