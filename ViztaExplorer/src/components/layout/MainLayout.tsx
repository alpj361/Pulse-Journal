import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, FileText, Wrench, FlaskConical, GitCompare, LogOut, User, Gamepad2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}

function NavItem({ to, icon, label, active }: NavItemProps) {
  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const navItems = [
    { to: '/', icon: <Brain size={18} />, label: 'Explorer' },
    { to: '/prompts', icon: <FileText size={18} />, label: 'Prompts' },
    { to: '/tools', icon: <Wrench size={18} />, label: 'Tools' },
    { to: '/experiments', icon: <FlaskConical size={18} />, label: 'Experiments' },
    { to: '/compare', icon: <GitCompare size={18} />, label: 'Compare' },
    { to: '/pixel', icon: <Gamepad2 size={18} />, label: 'Pixel' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Brain className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Vizta Explorer</h1>
              <p className="text-xs text-slate-400">Debug & Experiment with Vizta AI</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to}
              />
            ))}
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <User size={16} className="text-slate-400" />
              <span className="text-sm text-slate-300 max-w-[150px] truncate">
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
              title="Cerrar sesion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
