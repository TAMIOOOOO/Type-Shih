import React, { useState, useEffect } from 'react';
import {
  History,
  AlertTriangle,
  Award,
  Lock,
  RefreshCw,
  Zap,
  Calendar,
} from 'lucide-react';
import { GameResult, User, Theme } from '../types.js';
import { executeGraphQL, GAME_HISTORY_QUERY } from '../lib/graphqlClient.js';

interface HistoryViewProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onPlayClick: () => void;
  theme?: Theme;
}

const CACHE_HISTORY_KEY = 'typing_speed_cache_history';

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentUser,
  onOpenAuth,
  onPlayClick,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [history, setHistory] = useState<GameResult[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_HISTORY_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => history.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHistory = async (force = false) => {
    if (!currentUser) return;
    if (history.length === 0 || force) {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      const data = await executeGraphQL(
        GAME_HISTORY_QUERY,
        { limit: 50 },
        { forceRefresh: force, ttlMs: 45000 }
      );
      const list = Array.isArray(data?.gameHistory) ? data.gameHistory : [];
      setHistory(list);
      try {
        localStorage.setItem(CACHE_HISTORY_KEY, JSON.stringify(list));
      } catch {}
    } catch (err: any) {
      console.error('Failed to fetch user game history:', err);
      setErrorMessage(err?.message || 'Failed to fetch game history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchHistory(false);
    }
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-[#F27D26] mb-4 shadow-xl ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white'
          }`}
        >
          <Lock className="h-8 w-8" />
        </div>
        <h2 className={`text-2xl font-serif ${isDark ? 'text-white' : 'text-zinc-950'}`}>
          Private Match Archive
        </h2>
        <p
          className={`mt-2 text-xs uppercase tracking-[0.15em] max-w-md ${
            isDark ? 'text-white/40' : 'text-zinc-500'
          }`}
        >
          Authenticate your credentials to view your personal match logs, penalty analyses, and velocity history.
        </p>
        <div className="mt-6 flex space-x-3">
          <button
            id="btn-history-signin"
            onClick={onOpenAuth}
            className="rounded-xl bg-[#F27D26] px-5 py-2.5 text-xs font-bold text-black shadow-md shadow-[#F27D26]/20 hover:bg-[#ff8b38] transition"
          >
            Sign In / Register
          </button>
          <button
            id="btn-history-guest-play"
            onClick={onPlayClick}
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
              isDark
                ? 'border-white/10 bg-[#0C0C0C] text-white/80 hover:bg-white/5 hover:text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 shadow-xs'
            }`}
          >
            Engage as Guest
          </button>
        </div>
      </div>
    );
  }

  // Calculate personal stats
  const safeHistory = Array.isArray(history) ? history : [];
  const totalGames = safeHistory.length;
  let bestTime = currentUser.bestScore;
  let avgTime: number | null = null;

  if (totalGames > 0) {
    const sum = safeHistory.reduce((acc, curr) => acc + (curr?.totalTime || 0), 0);
    avgTime = Number((sum / totalGames).toFixed(2));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Header & Refresh */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F27D26]/10 border border-[#F27D26]/30 text-[#F27D26]">
              <History className="h-4 w-4" />
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-serif tracking-tight ${
                isDark ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {currentUser.username}'s History
            </h1>
          </div>
          <p
            className={`mt-1 text-xs uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            Private log of personal typing speed trials and precision statistics
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="btn-refresh-history"
            onClick={() => fetchHistory(true)}
            disabled={isLoading}
            className={`flex items-center space-x-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition disabled:opacity-50 ${
              isDark
                ? 'border-white/10 bg-[#0C0C0C] text-white/80 hover:bg-white/5 hover:text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 shadow-xs'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            id="btn-history-play"
            onClick={onPlayClick}
            className="flex items-center space-x-1.5 rounded-xl bg-[#F27D26] px-4 py-2 text-xs font-bold text-black shadow-md shadow-[#F27D26]/20 hover:bg-[#ff8b38] transition"
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            <span>New Match</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            Total Matches
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}
          >
            {totalGames}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            Personal Record
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-[#F27D26]">
            {bestTime ? `${bestTime.toFixed(2)}s` : '--'}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            Average Velocity
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              isDark ? 'text-white/90' : 'text-zinc-900'
            }`}
          >
            {avgTime ? `${avgTime.toFixed(2)}s` : '--'}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div
        className={`overflow-hidden rounded-2xl border shadow-xl ${
          isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white'
        }`}
      >
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${isDark ? 'text-[#D1D1D1]' : 'text-zinc-700'}`}>
            <thead
              className={`border-b text-[10px] uppercase tracking-[0.15em] font-semibold ${
                isDark
                  ? 'border-white/10 bg-[#050505] text-white/40'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
              }`}
            >
              <tr>
                <th className="py-3.5 px-4">Time / Score</th>
                <th className="py-3.5 px-4">Base Time</th>
                <th className="py-3.5 px-4">Penalties</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Sequence</th>
                <th className="py-3.5 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-zinc-100'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className={`py-12 text-center ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-[#F27D26]" />
                      <span className="text-xs uppercase tracking-wider">Loading match archives...</span>
                    </div>
                  </td>
                </tr>
              ) : errorMessage && safeHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <span className="text-rose-500">{errorMessage}</span>
                      <button
                        id="btn-retry-history"
                        type="button"
                        onClick={fetchHistory}
                        className={`inline-flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          isDark
                            ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Retry Connection</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : safeHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`py-12 text-center text-xs uppercase tracking-wider ${
                      isDark ? 'text-white/40' : 'text-zinc-400'
                    }`}
                  >
                    No games recorded yet. Initiate your first typing trial!
                  </td>
                </tr>
              ) : (
                safeHistory.map((game) => (
                  <tr
                    key={game.id}
                    className={`transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}
                  >
                    {/* Final Total Time */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-base text-[#F27D26]">
                          {game.totalTime.toFixed(2)}s
                        </span>
                        {game.isNewBestScore && (
                          <span
                            className={`inline-flex items-center space-x-1 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border ${
                              isDark
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            <Award className="h-3 w-3" />
                            <span>PB</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Base Time */}
                    <td
                      className={`py-3.5 px-4 font-mono text-xs ${
                        isDark ? 'text-white/60' : 'text-zinc-600'
                      }`}
                    >
                      {game.rawTime.toFixed(2)}s
                    </td>

                    {/* Penalties */}
                    <td className="py-3.5 px-4">
                      {game.wrongAttempts > 0 ? (
                        <div
                          className={`inline-flex items-center space-x-1 rounded px-2 py-0.5 text-xs font-semibold border ${
                            isDark
                              ? 'bg-rose-950/40 text-rose-300 border-rose-800/30'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <AlertTriangle
                            className={`h-3 w-3 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}
                          />
                          <span>+{game.penaltyTime.toFixed(2)}s</span>
                          <span
                            className={`text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-500'}`}
                          >
                            ({game.wrongAttempts})
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-medium ${
                            isDark ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          0.00s (Flawless)
                        </span>
                      )}
                    </td>

                    {/* Sequence */}
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span
                        className={`font-mono text-xs tracking-wider ${
                          isDark ? 'text-white/40' : 'text-zinc-500'
                        }`}
                      >
                        {game.sequence}
                      </span>
                    </td>

                    {/* Date */}
                    <td
                      className={`py-3.5 px-4 text-right text-xs font-mono ${
                        isDark ? 'text-white/40' : 'text-zinc-500'
                      }`}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <Calendar
                          className={`h-3 w-3 ${isDark ? 'text-white/30' : 'text-zinc-400'}`}
                        />
                        <span>
                          {new Date(game.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

