import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { GameArena } from './components/GameArena.js';
import { LeaderboardView } from './components/LeaderboardView.js';
import { HistoryView } from './components/HistoryView.js';
import { AuthModal } from './components/AuthModal.js';
import { User, Theme } from './types.js';
import { executeGraphQL, ME_QUERY, removeAuthToken } from './lib/graphqlClient.js';

const LOCAL_STORAGE_BEST_KEY = 'typing_speed_best_score';
const LOCAL_STORAGE_THEME_KEY = 'typing_speed_theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<'game' | 'leaderboard' | 'history'>('game');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_BEST_KEY);
    return cached ? parseFloat(cached) : null;
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    return cached === 'light' ? 'light' : 'dark';
  });
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Sync theme with HTML document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Check auth session on startup
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await executeGraphQL(ME_QUERY);
        if (data && data.me) {
          setCurrentUser(data.me);
          if (data.me.bestScore !== null) {
            // Update local best score if server has a record
            setBestScore((prev) => {
              if (prev === null || data.me.bestScore < prev) {
                localStorage.setItem(LOCAL_STORAGE_BEST_KEY, data.me.bestScore.toString());
                return data.me.bestScore;
              }
              return prev;
            });
          }
        }
      } catch {
        // Token invalid or expired - remove
        removeAuthToken();
      }
    }
    checkAuth();
  }, []);

  const handleUpdateBestScore = (newScore: number) => {
    setBestScore(newScore);
    localStorage.setItem(LOCAL_STORAGE_BEST_KEY, newScore.toString());
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        bestScore: currentUser.bestScore === null || newScore < currentUser.bestScore ? newScore : currentUser.bestScore,
      });
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.bestScore !== null) {
      setBestScore((prev) => {
        if (prev === null || user.bestScore! < prev) {
          localStorage.setItem(LOCAL_STORAGE_BEST_KEY, user.bestScore!.toString());
          return user.bestScore;
        }
        return prev;
      });
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-[#F27D26] selection:text-black relative transition-colors duration-200 ${
        isDark ? 'bg-[#050505] text-[#D1D1D1] theme-dark' : 'bg-[#F4F5F7] text-[#18181B] theme-light'
      }`}
    >
      {/* Subtle Dot Grid Background */}
      <div className={`fixed inset-0 bg-dot-grid pointer-events-none z-0 ${isDark ? 'opacity-25' : 'opacity-40'}`} />

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        bestScore={bestScore}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col justify-start relative z-10">
        {activeTab === 'game' && (
          <GameArena
            currentUser={currentUser}
            bestScore={bestScore}
            onUpdateBestScore={handleUpdateBestScore}
            onOpenAuth={() => setIsAuthOpen(true)}
            onViewLeaderboard={() => setActiveTab('leaderboard')}
            isMuted={isMuted}
            theme={theme}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            currentUser={currentUser}
            onPlayClick={() => setActiveTab('game')}
            theme={theme}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            onPlayClick={() => setActiveTab('game')}
            theme={theme}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        theme={theme}
      />

      {/* Footer */}
      <footer
        className={`border-t py-3 text-center text-xs relative z-10 transition-colors duration-200 ${
          isDark
            ? 'border-white/10 bg-[#080808] text-white/40'
            : 'border-zinc-200 bg-white text-zinc-500'
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
          <span className={`text-xs ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
            type-shih
          </span>
          <span className={`text-xs ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
            20 Random Alphabets
          </span>
        </div>
      </footer>
    </div>
  );
}
