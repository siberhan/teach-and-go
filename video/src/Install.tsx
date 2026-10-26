import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { PHONE_W, Phone, PhoneShell } from './Phone'

// How someone gets the app: the website in the phone browser, Share → Add to Home Screen,
// the new icon on the home screen, then the app opens on its key screen.
// Drawn in phone points (390 × 844) and scaled up to the phone size.

export type InstallTimes = { share: number; dialog: number; home: number; open: number; keys: number }

const PT = PHONE_W / 390
const SANS = '-apple-system, "SF Pro Text", system-ui, sans-serif'
const PEACH = '#f2b59a'

function Tap({ at, x, y }: { at: number; x: number; y: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = (frame - at * fps) / fps
  if (t < -0.35 || t > 0.45) return null
  const press = interpolate(t, [-0.35, 0, 0.45], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, background: 'rgba(40,40,60,0.35)', border: '2px solid rgba(255,255,255,0.9)', opacity: press, transform: `scale(${0.7 + press * 0.3})` }} />
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ position: 'absolute', top: 14, left: 34, right: 30, display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontWeight: 600, fontSize: 16, color: dark ? '#fff' : '#111' }}>
      <span>9:41</span>
      <span style={{ letterSpacing: 2 }}>▮▮▮ ◔</span>
    </div>
  )
}

function Browser() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff8f2' }}>
      <Img src={staticFile('cap/keys/00000.jpg')} style={{ position: 'absolute', top: 0, width: 390, height: 844 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, background: 'rgba(250,248,245,0.96)', borderTop: '1px solid #e6e1da', display: 'flex', alignItems: 'flex-start', padding: '12px 16px', gap: 14 }}>
        <span style={{ fontSize: 22, color: '#2b6de8', fontFamily: SANS, width: 24 }}>‹</span>
        <div style={{ flex: 1, height: 42, borderRadius: 21, background: '#ece8e2', display: 'grid', placeItems: 'center', fontFamily: SANS, fontSize: 15, color: '#222' }}>siberhan.me</div>
        <ShareIcon />
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="26" height="30" viewBox="0 0 24 28" fill="none" stroke="#2b6de8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 6 }}>
      <path d="M12 2v15M7 7l5-5 5 5" />
      <path d="M8 11H5v14h14V11h-3" />
    </svg>
  )
}

function ShareSheet({ from }: { from: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - from * fps, fps, config: { damping: 20 } })
  const rows = ['Copy', 'Add to Favorites', 'Add to Home Screen', 'Find on Page']
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.25 * s})` }} />
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, borderRadius: 26, background: '#f4f2ef', padding: '18px 14px 22px', transform: `translateY(${(1 - s) * 420}px)`, fontFamily: SANS }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px 16px' }}>
          <Img src={staticFile('logo-mark.png')} style={{ width: 44, height: 44, borderRadius: 10, background: PEACH }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Teach&amp;Go</div>
            <div style={{ fontSize: 13, color: '#888' }}>siberhan.me</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div key={r} style={{ padding: '15px 16px', fontSize: 17, borderTop: i ? '1px solid #eee' : 'none', display: 'flex', justifyContent: 'space-between', fontWeight: r === 'Add to Home Screen' ? 600 : 400 }}>
              {r}
              <span style={{ color: '#666' }}>{r === 'Add to Home Screen' ? '⊞' : '·'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function AddDialog({ from }: { from: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - from * fps, fps, config: { damping: 20 } })
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f4f2ef', transform: `translateY(${(1 - s) * 844}px)`, fontFamily: SANS }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '60px 20px 20px', fontSize: 17 }}>
        <span style={{ color: '#2b6de8' }}>Cancel</span>
        <b>Add to Home Screen</b>
        <span style={{ color: '#2b6de8', fontWeight: 600 }}>Add</span>
      </div>
      <div style={{ margin: '10px 16px', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
        <AppIcon size={62} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Teach&amp;Go</div>
          <div style={{ fontSize: 14, color: '#888' }}>https://siberhan.me/teach-and-go/</div>
        </div>
      </div>
    </div>
  )
}

function AppIcon({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.23, background: PEACH, display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
      <Img src={staticFile('logo-mark.png')} style={{ width: size * 0.7, height: size * 0.7 }} />
    </div>
  )
}

// A plain home screen: soft blank icons and one new arrival.
function Home({ from, open }: { from: number; open: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - (from + 0.5) * fps, fps, config: { damping: 9, mass: 0.6 } })
  const tints = ['#c9d6f7', '#f7d9c9', '#cfeedd', '#efd2ef', '#f6ecc2', '#d2e9f2', '#e2d8f7', '#f4cfd6', '#d8efcf', '#f2e0cc', '#cfe0ee']
  const icon = { x: 40 + 3 * 84, y: 96 + 2 * 102 }
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #b9b6f2 0%, #e9c3d6 55%, #f7d4bd 100%)' }}>
      <StatusBar dark />
      {tints.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: 40 + (i % 4) * 84, top: 96 + Math.floor(i / 4) * 102, width: 62, height: 62, borderRadius: 15, background: c, opacity: 0.9 }} />
      ))}
      <div style={{ position: 'absolute', left: icon.x - 10, top: icon.y, width: 82, textAlign: 'center', transform: `scale(${pop})` }}>
        <div style={{ marginLeft: 10 }}>
          <AppIcon size={62} />
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: '#fff', marginTop: 6, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Teach&amp;Go</div>
      </div>
      <Tap at={open} x={icon.x + 31} y={icon.y + 31} />
    </div>
  )
}

export function Install({ at }: { at: InstallTimes }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  // The app grows out of its icon when it opens.
  const grow = interpolate(t, [at.open + 0.1, at.open + 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  if (t >= at.open + 0.1) {
    const app = (
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${((40 + 3 * 84 + 31) / 390) * 100}% ${((96 + 2 * 102 + 31) / 844) * 100}%`, transform: `scale(${0.15 + grow * 0.85})`, borderRadius: 40 * (1 - grow), overflow: 'hidden' }}>
        <Phone phase="keys" bare pieces={[{ from: 0, to: 1400, speed: 1400 / ((at.keys - at.open) * 1000) }, { from: 1400, to: 5997 }]} />
      </div>
    )
    return (
      <PhoneShell>
        <div style={{ width: 390, height: 844, transform: `scale(${PT})`, transformOrigin: '0 0', position: 'absolute' }}>
          <Home from={at.home} open={at.open} />
        </div>
        {app}
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <div style={{ width: 390, height: 844, transform: `scale(${PT})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden' }}>
        {t < at.home ? (
          <>
            <Browser />
            {t >= at.share - 0.4 && <Tap at={at.share - 0.05} x={351} y={772} />}
            {t >= at.share && <ShareSheet from={at.share} />}
            {t >= at.share && t < at.dialog && <Tap at={at.dialog - 0.05} x={190} y={662} />}
            {t >= at.dialog && <AddDialog from={at.dialog} />}
            {t >= at.dialog && <Tap at={at.home - 0.1} x={355} y={70} />}
          </>
        ) : (
          <Home from={at.home} open={at.open} />
        )}
      </div>
    </PhoneShell>
  )
}
