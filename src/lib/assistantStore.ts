import { useSyncExternalStore } from 'react'

// Whether the assistant panel is open. Any screen's assistant button opens it.
let open = false
const listeners = new Set<() => void>()
const set = (v: boolean) => {
  open = v
  listeners.forEach((l) => l())
}
export const openAssistant = () => set(true)
export const closeAssistant = () => set(false)
export const useAssistantOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => open,
  )
