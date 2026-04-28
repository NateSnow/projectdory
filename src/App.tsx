import { Routes, Route } from 'react-router-dom'
import MainMenu from './components/MainMenu'
import GameBoard from './components/GameBoard'

function App() {
  return (
    <div className="h-full w-full">
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/play" element={<GameBoard />} />
      </Routes>
    </div>
  )
}

export default App
