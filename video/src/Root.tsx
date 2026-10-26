import { Composition } from 'remotion'
import { DURATION, Demo, FPS, SIZE } from './Demo'

export function Root() {
  return <Composition id="Demo" component={Demo} durationInFrames={DURATION} fps={FPS} {...SIZE} defaultProps={{ music: 'music.mp3' as string | undefined }} />
}
