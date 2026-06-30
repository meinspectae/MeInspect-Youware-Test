import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthStore } from '../../store/authStore';
import { client } from '../../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/new', label: 'New', icon: '➕' },
  { to: '/history', label: 'History', icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { reset } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const hideBottomNav = location.pathname === '/inspect';

  const handleLogout = async () => {
    await client.auth.signOut();
    localStorage.removeItem('meinspect_token');
    reset();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Welcome */}
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 group">
                <img src="/meinspect-logo.png" alt="MeInspect" className="h-8 w-auto" />
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">MeInspect</h1>
                  <p className="text-[10px] text-slate-400 leading-none -mt-0.5">Property Condition Reports</p>
                </div>
              </button>
              <div className="hidden md:block ml-4 pl-4 border-l border-slate-200">
                <p className="text-sm font-medium text-slate-700">
                  {user ? (
                    <span>Welcome, <span className="text-blue-600">{user.firstName}</span></span>
                  ) : (
                    <span>Welcome, <span className="text-slate-500">Guest</span></span>
                  )}
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
                  }>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Right side: User menu + Mobile hamburger */}
            <div className="flex items-center gap-2">
              {/* User avatar / menu */}
              {user && (
                <div className="relative">
                  <button onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-slate-700">{user.firstName}</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        ⚙️ Account Settings
                      </button>
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100">
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!user && (
                <button onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                  Sign In
                </button>
              )}

              {/* Mobile hamburger */}
              <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile welcome bar */}
        {user && (
          <div className="md:hidden px-4 py-2 bg-blue-50 border-t border-blue-100">
            <p className="text-xs font-medium text-blue-700">
              Welcome, {user.firstName} {user.lastName}
            </p>
          </div>
        )}

        {/* Mobile dropdown nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`
                  }>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {user && (
                <button onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
                  <span>👤</span><span>Account</span>
                </button>
              )}
              {user && (
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
                  <span>🚪</span><span>Sign Out</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom Tab Bar */}
      {!hideBottomNav && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <button key={item.to} onClick={() => { navigate(item.to); setMobileMenuOpen(false); }}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[64px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
