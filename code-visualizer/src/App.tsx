import { useState } from 'react'
import HomePage from './pages/HomePage'
import RepositoryPage from './pages/RepositoryPage'
import './index.css'

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'repository'>('home')

  const handleStart = () => {
    setCurrentView('repository')
  }

  return (
    <div className="app-container">
      {currentView === 'home' ? (
        <HomePage onStart={handleStart} />
      ) : (
        <RepositoryPage />
      )}
    </div>
  )
}

export default App
