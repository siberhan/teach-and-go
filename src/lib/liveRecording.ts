import { useSyncExternalStore } from 'react'
import { startRecording, type Recording } from './audio/recorder.ts'

// The one recording in progress, kept outside React so it survives leaving the recording screen.
// The bottom bar and the recording screen both read it through useLiveRecording().

export interface LiveState {
  spaceId: string
  seconds: number
  paused: boolean
}

let recording: Recording | null = null
let state: LiveState | null = null
let ticker: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function set(next: LiveState | null) {
  state = next
  listeners.forEach((l) => l())
}

function warnOnClose(e: BeforeUnloadEvent) {
  e.preventDefault()
}

function end() {
  clearInterval(ticker)
  window.removeEventListener('beforeunload', warnOnClose)
  recording = null
  set(null)
}

export async function startLive(spaceId: string) {
  if (recording) return
  recording = await startRecording()
  set({ spaceId, seconds: 0, paused: false })
  ticker = setInterval(() => state && recording && set({ ...state, seconds: recording.seconds() }), 250)
  window.addEventListener('beforeunload', warnOnClose)
}

export async function pauseLive() {
  if (!recording || !state || state.paused) return
  await recording.pause()
  set({ ...state, paused: true })
}

export async function resumeLive() {
  if (!recording || !state || !state.paused) return
  await recording.resume()
  set({ ...state, paused: false })
}

export async function stopLive(): Promise<Float32Array> {
  const pcm = await recording!.stop()
  end()
  return pcm
}

export function discardLive() {
  recording?.cancel()
  end()
}

export function useLiveRecording() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
