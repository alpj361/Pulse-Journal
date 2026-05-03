import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Explorer } from './pages/Explorer';
import { Prompts } from './pages/Prompts';
import { Tools } from './pages/Tools';
import { Experiments } from './pages/Experiments';
import { Compare } from './pages/Compare';
import { PixelNewsroom } from './pages/PixelNewsroom';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Routes>
                    <Route path="/" element={<Explorer />} />
                    <Route path="/prompts" element={<Prompts />} />
                    <Route path="/tools" element={<Tools />} />
                    <Route path="/experiments" element={<Experiments />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/pixel" element={<PixelNewsroom />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
