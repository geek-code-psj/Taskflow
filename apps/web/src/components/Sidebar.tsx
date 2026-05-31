import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, FolderOpen, LogOut, Zap,
  Settings, ChevronRight, Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="flex flex-col w-[220px] min-h-screen bg-surface-1 border-r border-white/[0.06] py-5 px-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-brand-400" />
        </div>
        <span className="font-display font-bold text-lg text-white tracking-tight">TaskFlow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('nav-item', isActive && 'active')
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/[0.06] pt-4 space-y-1">
        {user?.global_role === 'admin' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <Shield className="w-3 h-3 text-brand-400" />
            <span className="text-xs text-brand-400 font-medium">Admin</span>
          </div>
        )}
        <div className="px-2 py-2 rounded-lg bg-surface-2 border border-white/[0.06]">
          <div className="text-xs font-medium text-white truncate">{user?.username}</div>
          <div className="text-xs text-gray-400 truncate">{user?.email}</div>
        </div>
        <button
          onClick={logout}
          className="nav-item w-full text-left text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
