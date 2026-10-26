import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { Install, type InstallTimes } from './Install'
import { Mascot } from './Mascot'
import { PHONE_H, PHONE_W, Phone, pieceLength, type Piece } from './Phone'
import words from './words.json'

// The whole demo on one timeline. Narration is one voice file cut into chunks; each scene says
// where its chunks start, so captions, the mouth and the footage all follow the same clock.

export const FPS = 30
const W = 3840
const H = 2160
const f = (s: number) => Math.round(s * FPS)

const INK = '#22213a'
const ACCENT = '#6c6fd8'
const PEACH = '#f2b59a'
const FONT = '-apple-system, "SF Pro Display", system-ui, sans-serif'

// Footage: which part of each capture plays, and how fast.
const PLAN: Piece[] = [
  { from: 0, to: 8078, speed: 1.25 },
  { from: 8078, to: 13113, speed: 2.5 },
  { from: 13113, to: 17453 },
]
const LESSON_HEAD: Piece[] = [
  { from: 0, to: 2799, speed: 1.5 },
  { from: 2799, to: 86419, speed: 20 },
  { from: 86419, to: 89093, speed: 1.5 },
  { from: 89093, to: 90894 },
]
const CARD_AT = pieceLength(LESSON_HEAD) / 1000
const LESSON: Piece[] = [
  ...LESSON_HEAD,
  // The thread card stays up while the mascot talks about it.
  { from: 90894, to: 94963, speed: 4069 / 7900 },
  { from: 94963, to: 98000, speed: 1.5 },
]
const TOUR: Piece[] = [
  { from: 0, to: 2504, speed: 2 },
  { from: 2504, to: 10283, speed: 1.3 },
  { from: 10283, to: 18832, speed: 1.4 },
  { from: 18832, to: 23359 },
]
const TOUR_AT = (i: number) => pieceLength(TOUR.slice(0, i)) / 1000

// The developer's clip plays 15% faster and a little louder.
const ME_RATE = 1.15
const ME_SRC = 49.3
const ME_LEN = ME_SRC / ME_RATE
// Assistant demo, lined up with the developer's own words.
const A1_AT = 16.9
const A1: Piece[] = [
  { from: 0, to: 1400, speed: 1400 / (A1_AT * 1000) },
  { from: 1400, to: 6300, speed: 1.2 },
  { from: 6300, to: 11400, speed: 2.5 },
  { from: 11400, to: 13800 },
]
const A2_AT = pieceLength(A1) / 1000
const A2: Piece[] = [
  { from: 1300, to: 6900, speed: 1.2 },
  { from: 6900, to: 10356, speed: 3 },
  { from: 10356, to: 18921 },
]
// When the developer names the assistant, its button on the phone lights up (seconds in the scene).
const SPARKLE: [number, number][] = [
  [5.2, 8.2],
  [12.6, 16.4],
  [33.4, 40.5],
]

// Install walk-through, in seconds of the 'open' scene.
const OPEN_HOME = 0.3 + 79.7 - 74.3
const OPEN_KEYS = OPEN_HOME + 2.2

// Scenes in order. `voice` chunks are [start in scene, from, to] in seconds of voice.wav.
type Scene = { id: string; len: number; voice: [number, number, number][] }
const SCENES: Scene[] = [
  { id: 'intro', len: 6.6, voice: [[0, 0, 6.4]] },
  { id: 'plan', len: pieceLength(PLAN) / 1000 + 0.4, voice: [[0.3, 6.9, 18.9]] },
  { id: 'lesson', len: pieceLength(LESSON) / 1000 + 0.3, voice: [[0.4, 19.2, 28.2], [CARD_AT + 0.2, 28.9, 37.0]] },
  { id: 'tour', len: TOUR_AT(4) + 0.4, voice: [[TOUR_AT(1) + 0.2, 37.7, 43.3], [TOUR_AT(2) + 0.3, 43.8, 48.6], [TOUR_AT(3) - 0.3, 49.4, 54.8]] },
  { id: 'handoff', len: 5.0, voice: [[0.2, 55.8, 60.2]] },
  { id: 'me', len: ME_LEN, voice: [] },
  { id: 'cost', len: 13.0, voice: [[0.4, 61.3, 73.6]] },
  // A pause after "home screen" lets the new icon appear and open before the key line.
  { id: 'open', len: 12.2, voice: [[0.3, 74.3, 79.7], [OPEN_KEYS - 0.1, 79.8, 84.3]] },
  { id: 'close', len: 6.2, voice: [[0.3, 84.9, 88.56]] },
]
const START: Record<string, number> = {}
{
  let t = 0
  for (const s of SCENES) {
    START[s.id] = t
    t += s.len
  }
}
export const DURATION = f(SCENES.reduce((s, x) => s + x.len, 0))
// Scene time of a moment in voice.wav, for things that land on a word.
function onWord(scene: string, voiceSec: number) {
  const c = SCENES.find((s) => s.id === scene)!.voice.find(([, from, to]) => voiceSec >= from && voiceSec <= to)!
  return c[0] + voiceSec - c[1]
}

// Voice time at a video time, or null when the mascot is quiet.
const CHUNKS = SCENES.flatMap((s) => s.voice.map(([at, from, to]) => ({ at: START[s.id] + at, from, to })))
function voiceAt(t: number) {
  for (const c of CHUNKS) if (t >= c.at && t < c.at + (c.to - c.from)) return c.from + (t - c.at)
  return null
}
// Pointing at the phone, in seconds of voice.wav.
const PRESENT: [number, number][] = [
  [14.4, 15.6],
  [30.1, 31.4],
  [35.3, 36.6],
  [45.8, 46.7],
  [49.9, 50.8],
  [57.8, 60.2],
]

// Where the mascot stands in each scene (center x, center y, size, faces left).
const SPOTS: Record<string, { x: number; y: number; size: number; mirror: boolean }> = {
  intro: { x: 1920, y: 960, size: 1500, mirror: false },
  plan: { x: 1150, y: 1080, size: 1350, mirror: false },
  lesson: { x: 2700, y: 1080, size: 1350, mirror: true },
  tour: { x: 1150, y: 1080, size: 1350, mirror: false },
  handoff: { x: 1920, y: 1000, size: 1500, mirror: false },
  me: { x: 330, y: 1880, size: 640, mirror: false },
  cost: { x: 950, y: 1080, size: 1350, mirror: false },
  open: { x: 760, y: 1120, size: 1200, mirror: false },
  close: { x: 1250, y: 1040, size: 1400, mirror: false },
}

function sceneAt(t: number) {
  let cur = SCENES[0]
  for (const s of SCENES) if (t >= START[s.id]) cur = s
  return cur
}

function MascotLayer() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const scene = sceneAt(t)
  const i = SCENES.indexOf(scene)
  const to = SPOTS[scene.id]
  const from = SPOTS[SCENES[Math.max(0, i - 1)].id]
  const k = interpolate(t - START[scene.id], [0, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const x = from.x + (to.x - from.x) * k
  const y = from.y + (to.y - from.y) * k
  const size = from.size + (to.size - from.size) * k
  const v = voiceAt(t)
  const present = v !== null && PRESENT.some(([a, b]) => v >= a && v < b)
  // Pops in at the start, like it jumped onto the stage.
  const enter = spring({ frame, fps: FPS, config: { damping: 11, mass: 0.7 } })
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, transform: `scale(${enter})`, transformOrigin: '50% 90%' }}>
      <Mascot voice="voice.wav" voiceTime={v} pose={present ? 'present' : 'talk'} mirror={k > 0.5 ? to.mirror : from.mirror} size={size} />
    </div>
  )
}

// Captions: short groups of words, the spoken word in the accent color.
type Word = { w: string; s: number; e: number }
function groups(list: Word[]) {
  const out: Word[][] = []
  let cur: Word[] = []
  list.forEach((w, i) => {
    cur.push(w)
    const next = list[i + 1]
    if (!next || /[.,?!]$/.test(w.w) || cur.length >= 4 || next.s - w.e > 0.25) {
      out.push(cur)
      cur = []
    }
  })
  return out
}
const VOICE_GROUPS = groups(words.voice)
const ME_GROUPS = groups(words.me.map((w) => ({ w: w.w, s: w.s / ME_RATE, e: w.e / ME_RATE })))

function CaptionLine({ line, t }: { line: Word[]; t: number }) {
  return (
    <div style={{ display: 'inline-block', padding: '22px 48px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', boxShadow: '0 20px 60px rgba(60,60,120,0.12)', fontFamily: FONT, fontWeight: 700, fontSize: 92, letterSpacing: -1, color: INK, whiteSpace: 'nowrap' }}>
      {line.map((w, i) => (
        <span key={i} style={{ color: t >= w.s ? (t < (line[i + 1]?.s ?? w.e + 0.3) ? ACCENT : INK) : 'rgba(34,33,58,0.35)' }}>
          {(i ? ' ' : '') + w.w}
        </span>
      ))}
    </div>
  )
}

function lineAt(list: Word[][], t: number) {
  return list.find((g, i) => t >= g[0].s - 0.05 && t < Math.min(g.at(-1)!.e + 0.5, list[i + 1]?.[0].s ?? Infinity))
}

function VoiceCaptions() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const v = voiceAt(t)
  if (v === null) return null
  const line = lineAt(VOICE_GROUPS, v)
  if (!line) return null
  const scene = sceneAt(t)
  const spot = SPOTS[scene.id]
  const centered = scene.id === 'intro' || scene.id === 'handoff'
  return (
    <div style={{ position: 'absolute', left: centered ? 0 : spot.x - 1000, width: centered ? W : 2000, top: centered ? 1820 : 1840, textAlign: 'center' }}>
      <CaptionLine line={line} t={v} />
    </div>
  )
}

function slideIn(frame: number, dir: 1 | -1 = 1) {
  const s = spring({ frame, fps: FPS, config: { damping: 18, mass: 0.9 } })
  return `translateY(${(1 - s) * 1400 * dir}px)`
}

function PhoneAt({ x, from = 0, children }: { x: number; from?: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  return <div style={{ position: 'absolute', left: x - PHONE_W / 2 - 34, top: (H - PHONE_H) / 2 - 34, transform: from >= 0 ? slideIn(frame - from) : undefined }}>{children}</div>
}

function Brand() {
  return (
    <div style={{ position: 'absolute', left: 110, top: 90, display: 'flex', alignItems: 'center', gap: 28, fontFamily: FONT, fontWeight: 800, fontSize: 72, color: INK, letterSpacing: -1.5 }}>
      <Img src={staticFile('logo-mark.png')} style={{ width: 110, height: 110 }} />
      Teach&amp;Go
    </div>
  )
}

function SparkleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />
      <path d="M17.5 14c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8Z" />
    </svg>
  )
}

// The assistant button on the phone glows, and a big copy of it appears beside the phone.
function SparkleCallout({ phoneX }: { phoneX: number }) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const win = SPARKLE.find(([a, b]) => t >= a - 0.3 && t < b + 0.4)
  if (!win) return null
  const s = spring({ frame: frame - f(win[0]), fps: FPS, config: { damping: 12 } })
  const out = interpolate(t, [win[1], win[1] + 0.4], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(t * Math.PI * 2.4) * 0.06
  // The button sits at (347, 45) in phone points.
  const pt = PHONE_W / 390
  const bx = phoneX - PHONE_W / 2 + 347 * pt
  const by = (H - PHONE_H) / 2 + 45 * pt
  return (
    <>
      <div style={{ position: 'absolute', left: bx - 95, top: by - 95, width: 190, height: 190, borderRadius: 60, border: `12px solid ${ACCENT}`, boxShadow: `0 0 60px ${ACCENT}`, opacity: s * out, transform: `scale(${pulse})` }} />
      <div style={{ position: 'absolute', left: bx + 260, top: by + 60, width: 380, textAlign: 'center', opacity: s * out, transform: `scale(${s})`, transformOrigin: '0 0', fontFamily: FONT }}>
        <div style={{ width: 300, height: 300, margin: '0 auto', borderRadius: 80, background: PEACH, border: `10px solid ${INK}`, boxShadow: `14px 16px 0 ${INK}`, display: 'grid', placeItems: 'center' }}>
          <SparkleIcon size={200} />
        </div>
        <div style={{ marginTop: 50, fontSize: 64, fontWeight: 800, color: INK }}>Assistant</div>
        <div style={{ fontSize: 46, fontWeight: 500, color: 'rgba(34,33,58,0.6)' }}>on every screen</div>
      </div>
    </>
  )
}

function Me() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const line = lineAt(ME_GROUPS, t)
  const pop = spring({ frame, fps: FPS, config: { damping: 14 } })
  const out = interpolate(frame, [f(ME_LEN) - 12, f(ME_LEN)], [1, 0], { extrapolateLeft: 'clamp' })
  const size = 820
  const phoneX = 2500
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 1200 - size / 2, top: 360, width: size, transform: `scale(${pop * out})`, transformOrigin: '50% 50%' }}>
        <div style={{ width: size, height: size, borderRadius: 72, overflow: 'hidden', boxShadow: '0 40px 100px rgba(60,60,120,0.25)', border: '14px solid #fff' }}>
          <OffthreadVideo src={staticFile('me.mov')} endAt={f(ME_SRC)} playbackRate={ME_RATE} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ marginTop: 34, textAlign: 'center', fontFamily: FONT, fontSize: 60, fontWeight: 700, color: INK }}>
          Bedirhan <span style={{ fontWeight: 500, color: 'rgba(34,33,58,0.55)' }}>· developer</span>
        </div>
      </div>
      {/* The developer's voice, boosted 150% ahead of time: Remotion caps volume at 1. */}
      <Audio src={staticFile('me-voice.m4a')} endAt={f(ME_SRC)} playbackRate={ME_RATE} />
      {line && (
        <div style={{ position: 'absolute', left: 1200 - 1000, width: 2000, top: 1500, textAlign: 'center' }}>
          <CaptionLine line={line} t={t} />
        </div>
      )}
      <Sequence durationInFrames={f(A2_AT) + 1}>
        <PhoneAt x={phoneX}>
          <Phone phase="a1" pieces={A1} />
        </PhoneAt>
      </Sequence>
      <Sequence from={f(A2_AT)}>
        <PhoneAt x={phoneX} from={-1}>
          <Phone phase="a2" pieces={A2} />
        </PhoneAt>
      </Sequence>
      <SparkleCallout phoneX={phoneX} />
    </AbsoluteFill>
  )
}

// Cards for the models and the price; each one lands on the word that names it.
function Cost() {
  const frame = useCurrentFrame()
  const at = (voiceSec: number) => f(onWord('cost', voiceSec))
  const cards = [
    { at: at(64.4), title: 'GPT-6 Luna', sub: 'thinks · plans · uses the app’s tools' },
    { at: at(66.8), title: 'Whisper large v3', sub: 'listens · free on Groq, OpenRouter as backup' },
    { at: at(70.1), title: '≈ $0.015', sub: 'per 30-minute lesson' },
  ]
  const coffee = spring({ frame: frame - at(71.3), fps: FPS, config: { damping: 12 } })
  return (
    <AbsoluteFill>
      {cards.map((c, i) => {
        const s = spring({ frame: frame - c.at, fps: FPS, config: { damping: 15 } })
        const big = i === 2
        return (
          <div key={i} style={{ position: 'absolute', left: 1900, top: 330 + i * 470, width: 1620, height: 400, borderRadius: 64, background: big ? ACCENT : '#fff', color: big ? '#fff' : INK, boxShadow: '0 30px 80px rgba(60,60,120,0.15)', padding: '0 90px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: FONT, opacity: s, transform: `translateX(${(1 - s) * 300}px)` }}>
            <div style={{ fontSize: big ? 150 : 120, fontWeight: 800, letterSpacing: -3 }}>{c.title}</div>
            <div style={{ fontSize: 56, fontWeight: 500, opacity: 0.7, marginTop: 8 }}>{c.sub}</div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: 3230, top: 1350, fontSize: 190, transform: `scale(${coffee}) rotate(${(1 - coffee) * -30}deg)` }}>☕️</div>
    </AbsoluteFill>
  )
}

// Open source, and how to get it: the phone walks through installing from the website.
const INSTALL: InstallTimes = {
  share: onWord('open', 78.4),
  dialog: onWord('open', 79.05),
  home: OPEN_HOME,
  open: OPEN_HOME + 1.4,
  keys: OPEN_KEYS,
}
function OpenSource() {
  const frame = useCurrentFrame()
  const cards = [
    { at: onWord('open', 75.2), title: 'Open source', sub: 'MIT · github.com/siberhan/teach-and-go' },
    { at: onWord('open', 77.3), title: 'siberhan.me/teach-and-go', sub: 'add it to your home screen' },
    { at: onWord('open', 80.0), title: 'Your own API key', sub: 'no account · no server' },
  ]
  return (
    <AbsoluteFill>
      {cards.map((c, i) => {
        const s = spring({ frame: frame - f(c.at), fps: FPS, config: { damping: 15 } })
        return (
          <div key={i} style={{ position: 'absolute', left: 1420, top: 360 + i * 300, width: 980, padding: '40px 56px', borderRadius: 48, background: '#fff', boxShadow: '0 30px 80px rgba(60,60,120,0.15)', fontFamily: FONT, color: INK, opacity: s, transform: `translateY(${(1 - s) * 60}px)` }}>
            <div style={{ fontSize: i === 1 ? 58 : 72, fontWeight: 800, letterSpacing: -1.5 }}>{c.title}</div>
            <div style={{ fontSize: 44, fontWeight: 500, opacity: 0.6, marginTop: 6 }}>{c.sub}</div>
          </div>
        )
      })}
      <PhoneAt x={2950}>
        <Install at={INSTALL} />
      </PhoneAt>
    </AbsoluteFill>
  )
}

function Close() {
  const frame = useCurrentFrame()
  const show = (sec: number) => spring({ frame: frame - f(sec), fps: FPS, config: { damping: 15 } })
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: INK }}>
      <div style={{ position: 'absolute', left: 2100, top: 560, opacity: show(0.2), transform: `translateY(${(1 - show(0.2)) * 80}px)`, display: 'flex', alignItems: 'center', gap: 50 }}>
        <Img src={staticFile('logo-mark.png')} style={{ width: 260, height: 260 }} />
        <div style={{ fontSize: 230, fontWeight: 800, letterSpacing: -6 }}>Teach&amp;Go</div>
      </div>
      <div style={{ position: 'absolute', left: 2110, top: 940, fontSize: 110, fontWeight: 700, lineHeight: 1.2 }}>
        <div style={{ opacity: show(0.6) }}>You teach.</div>
        <div style={{ opacity: show(1.8), color: ACCENT }}>We keep the thread.</div>
      </div>
      <div style={{ position: 'absolute', left: 2110, top: 1330, fontSize: 64, fontWeight: 500, opacity: show(3.4) * 0.65 }}>siberhan.me/teach-and-go</div>
    </AbsoluteFill>
  )
}

export function Demo({ music }: { music?: string }) {
  const s = (id: string) => f(START[id])
  const len = (id: string) => f(SCENES.find((x) => x.id === id)!.len)
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 30% 20%, #f4f2ff 0%, #e4e3fb 45%, #d6d6f5 100%)' }}>
      {SCENES.flatMap((sc) =>
        sc.voice.map(([at, from, to], i) => (
          <Sequence key={sc.id + i} from={f(START[sc.id] + at)} durationInFrames={f(to - from)}>
            <Audio src={staticFile('voice.wav')} startFrom={f(from)} endAt={f(to)} />
          </Sequence>
        )),
      )}
      {music && <Audio src={staticFile(music)} volume={(fr) => musicVolume(fr / FPS)} />}

      <Sequence from={s('plan')} durationInFrames={len('plan')}>
        <PhoneAt x={2620}>
          <Phone phase="plan" pieces={PLAN} />
        </PhoneAt>
      </Sequence>
      <Sequence from={s('lesson')} durationInFrames={len('lesson')}>
        <PhoneAt x={1220}>
          <Phone phase="lesson" pieces={LESSON} />
        </PhoneAt>
      </Sequence>
      <Sequence from={s('tour')} durationInFrames={len('tour')}>
        <PhoneAt x={2620}>
          <Phone phase="tour" pieces={TOUR} />
        </PhoneAt>
      </Sequence>
      <Sequence from={s('me')} durationInFrames={len('me')}>
        <Me />
      </Sequence>
      <Sequence from={s('cost')} durationInFrames={len('cost')}>
        <Cost />
      </Sequence>
      <Sequence from={s('open')} durationInFrames={len('open')}>
        <OpenSource />
      </Sequence>
      <Sequence from={s('close')}>
        <Close />
      </Sequence>

      <Sequence from={s('plan')} durationInFrames={s('close') - s('plan')}>
        <Brand />
      </Sequence>
      <MascotLayer />
      <VoiceCaptions />
    </AbsoluteFill>
  )
}

// Music: full at the start, a quiet bed under the mascot, almost silent while the developer talks, up at the end.
function musicVolume(t: number) {
  const me = START.me
  const meEnd = me + ME_LEN
  const close = START.close
  return interpolate(t, [0, 4.5, 6.6, me - 0.5, me + 0.5, meEnd - 0.5, meEnd + 0.5, close, close + 1, DURATION / FPS - 1.5, DURATION / FPS], [0.5, 0.5, 0.12, 0.12, 0.03, 0.03, 0.12, 0.12, 0.45, 0.45, 0], { extrapolateRight: 'clamp' })
}

export const SIZE = { width: W, height: H }
