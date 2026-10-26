import { Route, Routes } from 'react-router-dom'
import Start from './screens/Start.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
    </Routes>
  )
}
