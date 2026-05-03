import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4">
            <span className="text-3xl font-bold text-white">V</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Vizta Explorer</h1>
          <p className="text-slate-400 mt-2">
            Conecta con tu cuenta de Pulse Journal
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
        >
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg
                         text-white placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         transition-colors"
            />
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
              required
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg
                         text-white placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-3
                       bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg
                       hover:from-cyan-600 hover:to-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Iniciar Sesion
              </>
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-sm text-slate-500 mt-4">
            Usa las mismas credenciales de{' '}
            <span className="text-cyan-400">ThePulse</span>
          </p>
        </form>
      </div>
    </div>
  );
}
