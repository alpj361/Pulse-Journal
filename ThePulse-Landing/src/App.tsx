import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Pricing from './pages/Pricing'
import Support from './pages/Support'
import Marketing from './pages/Marketing'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="/marketing" element={<Marketing />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
