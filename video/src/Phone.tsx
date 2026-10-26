import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { captures } from './captures'

// The app footage inside a phone frame. `pieces` maps video time to capture time:
// each piece plays [from, to] ms of the capture at `speed`, one after another.

export type Piece = { from: number; to: number; speed?: number }

export function pieceLength(pieces: Piece[]) {
  return pieces.reduce((s, p) => s + (p.to - p.from) / (p.speed ?? 1), 0)
}

function captureTime(pieces: Piece[], ms: number) {
  let left = ms
  for (const p of pieces) {
    const len = (p.to - p.from) / (p.speed ?? 1)
    if (left <= len) return p.from + left * (p.speed ?? 1)
    left -= len
  }
  return pieces.at(-1)!.to
}

export const PHONE_W = 860
export const PHONE_H = (PHONE_W * 844) / 390

export function Phone({ phase, pieces, bare = false }: { phase: string; pieces: Piece[]; bare?: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const frames = captures[phase]
  const t = captureTime(pieces, (frame / fps) * 1000)
  // Latest captured frame at or before t.
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  const img = <Img src={staticFile(`cap/${phase}/${frames[lo].file}`)} style={{ width: '100%', height: '100%', display: 'block' }} />
  return bare ? img : <PhoneShell>{img}</PhoneShell>
}

export function PhoneShell({ children }: { children: React.ReactNode }) {
  const bezel = 34
  return (
    <div
      style={{
        width: PHONE_W + bezel * 2,
        height: PHONE_H + bezel * 2,
        padding: bezel,
        borderRadius: 150,
        background: '#1d1b2e',
        boxShadow: '0 60px 120px rgba(40, 40, 90, 0.28), inset 0 0 0 6px #33304a',
      }}
    >
      <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 118, overflow: 'hidden', position: 'relative', background: '#fff8f2' }}>{children}</div>
    </div>
  )
}
