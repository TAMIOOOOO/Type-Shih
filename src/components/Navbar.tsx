import React from 'react';
import {
  Zap,
  Trophy,
  History,
  User as UserIcon,
  LogOut,
  Volume2,
  VolumeX,
  Sun,
  Moon,
} from 'lucide-react';
import { User, Theme } from '../types.js';

interface NavbarProps {
  activeTab: 'game' | 'leaderboard' | 'history';
  setActiveTab: (tab: 'game' | 'leaderboard' | 'history') => void;
  currentUser: User | null;
  bestScore: number | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  bestScore,
  onOpenAuth,
  onLogout,
  isMuted,
  setIsMuted,
  theme,
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-200 ${
        isDark
          ? 'border-white/10 bg-[#050505]/95 text-[#D1D1D1]'
          : 'border-zinc-200/80 bg-white/95 text-zinc-800 shadow-sm'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand / Logo */}
        <div
          id="brand-logo"
          onClick={() => setActiveTab('game')}
          className="flex cursor-pointer items-center space-x-3 transition hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F27D26]/40 bg-[#F27D26]/10 text-[#F27D26] shadow-sm shadow-[#F27D26]/20">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-lg sm:text-xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-950'
                }`}
              >
                type-shih
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          className={`flex items-center space-x-1 sm:space-x-2 rounded-xl p-1 ${
            isDark ? 'bg-[#080808]/60 border border-white/5' : 'bg-zinc-100 border border-zinc-200/70'
          }`}
        >
          <button
            id="nav-tab-game"
            onClick={() => setActiveTab('game')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
              activeTab === 'game'
                ? 'bg-[#F27D26] text-black font-bold shadow-sm shadow-[#F27D26]/20'
                : isDark
                ? 'text-white/60 hover:bg-white/5 hover:text-white'
                : 'text-zinc-600 hover:bg-white hover:text-zinc-950'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Play</span>
          </button>

          <button
            id="nav-tab-leaderboard"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
              activeTab === 'leaderboard'
                ? 'bg-[#F27D26] text-black font-bold shadow-sm shadow-[#F27D26]/20'
                : isDark
                ? 'text-white/60 hover:bg-white/5 hover:text-white'
                : 'text-zinc-600 hover:bg-white hover:text-zinc-950'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </button>

          <button
            id="nav-tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
              activeTab === 'history'
                ? 'bg-[#F27D26] text-black font-bold shadow-sm shadow-[#F27D26]/20'
                : isDark
                ? 'text-white/60 hover:bg-white/5 hover:text-white'
                : 'text-zinc-600 hover:bg-white hover:text-zinc-950'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </button>
        </nav>

        {/* Right Controls: Theme Toggle, Sound, Best Score, Auth */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Theme toggle button */}
          <button
            id="btn-toggle-theme"
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              isDark
                ? 'border-white/10 bg-[#0C0C0C] text-amber-400 hover:bg-white/5 hover:text-amber-300'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 shadow-sm'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          {/* Audio toggle button */}
          <button
            id="btn-toggle-sound"
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              isDark
                ? 'border-white/10 bg-[#0C0C0C] text-white/50 hover:bg-white/5 hover:text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 shadow-sm'
            }`}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-[#F27D26]" />}
          </button>

          {/* Local / User Best score badge */}
          {bestScore !== null && (
            <div
              id="badge-best-score"
              className={`hidden sm:flex items-center space-x-1.5 rounded-lg border border-[#F27D26]/30 bg-[#F27D26]/10 px-2.5 py-1 text-xs font-semibold text-[#F27D26] ${
                !isDark ? 'shadow-xs' : ''
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
                PB:
              </span>
              <span className="font-mono text-[#F27D26]">{bestScore.toFixed(2)}s</span>
            </div>
          )}

          {/* User Account / Auth trigger */}
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div
                id="user-profile-badge"
                className={`flex items-center space-x-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  isDark
                    ? 'border-white/10 bg-[#0C0C0C] text-white/80'
                    : 'border-zinc-200 bg-white text-zinc-800 shadow-sm'
                }`}
              >
                <div className="h-2 w-2 rounded-full bg-[#F27D26] animate-pulse" />
                <span className="max-w-[100px] truncate">{currentUser.username}</span>
              </div>
              <button
                id="btn-logout"
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  isDark
                    ? 'border-white/10 bg-[#0C0C0C] text-white/40 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/40'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm'
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-open-login"
              onClick={onOpenAuth}
              className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                isDark
                  ? 'border-white/15 bg-white/5 text-white hover:bg-[#F27D26] hover:text-black hover:border-[#F27D26]'
                  : 'border-zinc-300 bg-zinc-900 text-white hover:bg-[#F27D26] hover:text-black hover:border-[#F27D26]'
              }`}
            >
              <UserIcon className="h-3.5 w-3.5 text-[#F27D26]" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

