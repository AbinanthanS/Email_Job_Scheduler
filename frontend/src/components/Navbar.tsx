import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, LogOut, Activity, Plus, RefreshCw, Mail } from 'lucide-react';

interface NavbarProps {
  onOpenCompose: () => void;
  onOpenQueueHealth: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCompose,
  onOpenQueueHealth,
  onRefresh,
  isRefreshing,
}) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B0F19]/80 backdrop-blur-xl border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">ReachInbox</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Scheduler
                </span>
              </div>
              <p className="text-xs text-gray-400 font-normal hidden sm:block">Persistent Queue & Rate Limiter</p>
            </div>
          </div>

          {/* Action Buttons & Profile */}
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh queue status"
              className="p-2 text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded-xl transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>

            {/* Queue Engine Metrics Button */}
            <button
              onClick={onOpenQueueHealth}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800/60 hover:bg-gray-850 border border-gray-700/60 text-xs font-medium text-gray-300 hover:text-white transition-all shadow-sm"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Queue Status</span>
            </button>

            {/* Compose New Email Button */}
            <button
              onClick={onOpenCompose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Compose New Email</span>
              <span className="sm:hidden">Compose</span>
            </button>

            {/* User Profile & Logout */}
            <div className="relative ml-2">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-gray-800/80 transition-colors border border-transparent hover:border-gray-700"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-lg object-cover ring-2 ring-brand-500/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-inner">
                    {user?.name ? user.name.charAt(0) : user?.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-medium text-gray-200 truncate max-w-[120px]">{user?.name || 'User'}</div>
                  <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{user?.email}</div>
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div
                  onMouseLeave={() => setShowUserMenu(false)}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-1.5 z-50 animate-fade-in"
                >
                  <div className="px-3 py-2 border-b border-gray-800 mb-1">
                    <p className="text-xs font-semibold text-white">{user?.name || 'Signed in'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenQueueHealth();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Queue & Rate Limits</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
