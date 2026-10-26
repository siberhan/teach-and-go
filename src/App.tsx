import { Route, Routes } from 'react-router-dom'
import Shell from './components/Shell.tsx'
import LessonDetail from './screens/LessonDetail.tsx'
import LessonFinished from './screens/LessonFinished.tsx'
import NewRecording from './screens/NewRecording.tsx'
import Settings from './screens/Settings.tsx'
import Space from './screens/Space.tsx'
import Spaces from './screens/Spaces.tsx'
import SpaceSettings from './screens/SpaceSettings.tsx'
import Start from './screens/Start.tsx'
import ThreadDetail from './screens/ThreadDetail.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route element={<Shell />}>
        <Route path="/settings" element={<Settings />} />
        <Route path="/spaces" element={<Spaces />} />
        <Route path="/space/:id" element={<Space />} />
        <Route path="/space/:id/settings" element={<SpaceSettings />} />
        <Route path="/space/:id/record" element={<NewRecording />} />
        <Route path="/space/:id/thread" element={<ThreadDetail />} />
        <Route path="/lesson/:lessonId" element={<LessonDetail />} />
        <Route path="/lesson/:lessonId/finished" element={<LessonFinished />} />
      </Route>
    </Routes>
  )
}
