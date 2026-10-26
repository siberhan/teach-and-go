import { Route, Routes } from 'react-router-dom'
import Settings from './screens/Settings.tsx'
import Space from './screens/Space.tsx'
import Spaces from './screens/Spaces.tsx'
import Start from './screens/Start.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/spaces" element={<Spaces />} />
      <Route path="/space/:id" element={<Space />} />
    </Routes>
  )
}
