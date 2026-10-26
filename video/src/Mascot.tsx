import { useAudioData } from '@remotion/media-utils'
import { Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

// The talking bookmark. The mouth follows the loudness of the narration at `voiceTime`
// (closed, small smile, open smile); it blinks on a fixed rhythm so renders are repeatable.

type Pose = 'talk' | 'present'

const FRAMES = { base: 'mascot/base.png', mid: 'mascot/mid.png', wide: 'mascot/wide.png', blink: 'mascot/blink.png', present: 'mascot/present.png' }

export function Mascot({ voice, voiceTime, pose = 'talk', mirror = false, size = 1300 }: { voice: string; voiceTime: number | null; pose?: Pose; mirror?: boolean; size?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const audio = useAudioData(staticFile(voice))

  let level = 0
  if (audio && voiceTime !== null) {
    // Mouth shapes change at most 15 times a second, like hand-drawn animation.
    const t = Math.floor(voiceTime * 15) / 15
    const data = audio.channelWaveforms[0]
    const from = Math.max(0, Math.floor((t - 0.03) * audio.sampleRate))
    const to = Math.min(data.length, Math.floor((t + 0.03) * audio.sampleRate))
    let sum = 0
    for (let i = from; i < to; i++) sum += data[i] * data[i]
    level = to > from ? Math.sqrt(sum / (to - from)) : 0
  }

  const blinking = frame % 110 < 4
  let key: keyof typeof FRAMES = level > 0.12 ? 'wide' : level > 0.04 ? 'mid' : blinking ? 'blink' : 'base'
  if (pose === 'present') key = 'present'

  // A soft idle bob so it never looks like a sticker.
  const bob = Math.sin((frame / fps) * Math.PI * 1.2) * 10

  return (
    <div style={{ width: size, height: size, position: 'relative', transform: `translateY(${bob}px) scaleX(${mirror ? -1 : 1})` }}>
      {Object.entries(FRAMES).map(([k, src]) => (
        <Img key={k} src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: k === key ? 1 : 0 }} />
      ))}
    </div>
  )
}
