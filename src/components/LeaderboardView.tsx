import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  RefreshCw,
  Search,
  Zap,
  Timer,
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { LeaderboardEntry, GlobalStats, User, Theme } from '../types.js';
import { executeGraphQL, LEADERBOARD_QUERY, STATS_QUERY } from '../lib/graphqlClient.js';

interface LeaderboardViewProps {
  currentUser: User | null;
  onPlayClick: () => void;
  theme?: Theme;
}

const CACHE_LEADERBOARD_KEY = 'typing_speed_cache_leaderboard';
const CACHE_STATS_KEY = 'typing_speed_cache_stats';
const CACHE_MY_RANK_KEY = 'typing_speed_cache_my_rank';
const MOCK_USER_IDS = new Set(['user-alex', 'user-john', 'user-sarah', 'user-emily', 'user-michael']);

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  onPlayClick,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Raw leaderboard list (capped to top 50)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_LEADERBOARD_KEY);
      if (!cached) return [];
      const parsed: LeaderboardEntry[] = JSON.parse(cached);
      return parsed.filter((e) => !MOCK_USER_IDS.has(e.userId)).slice(0, 50);
    } catch {
      return [];
    }
  });

  // Current user's specific rank
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_MY_RANK_KEY);
      if (!cached) return null;
      const parsed: LeaderboardEntry = JSON.parse(cached);
      return MOCK_USER_IDS.has(parsed.userId) ? null : parsed;
    } catch {
      return null;
    }
  });

  // Global aggregate stats
  const [stats, setStats] = useState<GlobalStats | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_STATS_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => leaderboard.length === 0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLiveAutoRefresh, setIsLiveAutoRefresh] = useState<boolean>(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchLeaderboardData = async (silent = false) => {
    if (!silent && leaderboard.length === 0) setIsLoading(true);
    setErrorMessage(null);
    try {
      const [lbData, statsData] = await Promise.all([
        executeGraphQL(LEADERBOARD_QUERY, { limit: 50 }),
        executeGraphQL(STATS_QUERY),
      ]);

      if (lbData?.leaderboard && Array.isArray(lbData.leaderboard)) {
        const top50 = lbData.leaderboard.slice(0, 50);
        setLeaderboard(top50);
        try {
          localStorage.setItem(CACHE_LEADERBOARD_KEY, JSON.stringify(top50));
        } catch {}
      }

      if (lbData?.myRank) {
        setMyRank(lbData.myRank);
        try {
          localStorage.setItem(CACHE_MY_RANK_KEY, JSON.stringify(lbData.myRank));
        } catch {}
      } else if (currentUser && lbData?.leaderboard) {
        // Fallback calculation if logged in
        const userInList = lbData.leaderboard.find((e: LeaderboardEntry) => e.userId === currentUser.id);
        if (userInList) {
          setMyRank(userInList);
        }
      }

      if (statsData?.stats) {
        setStats(statsData.stats);
        try {
          localStorage.setItem(CACHE_STATS_KEY, JSON.stringify(statsData.stats));
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to fetch leaderboard data:', err);
      if (!silent) {
        setErrorMessage(err?.message || 'Unable to sync leaderboard at this time');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, [currentUser?.id]);

  // Real-time auto-refresh polling
  useEffect(() => {
    if (!isLiveAutoRefresh) return;
    const interval = setInterval(() => {
      fetchLeaderboardData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isLiveAutoRefresh, currentUser?.id]);

  // Filtered leaderboard (max 50)
  const filteredLeaderboard = useMemo(() => {
    const list = Array.isArray(leaderboard) ? leaderboard.slice(0, 50) : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((entry) => (entry?.player || '').toLowerCase().includes(q));
  }, [leaderboard, searchQuery]);

  // Reset to page 1 on search or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  // Pagination calculation
  const totalItems = filteredLeaderboard.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedEntries = filteredLeaderboard.slice(startIndex, endIndex);

  // Check if current user is visible in the current page table view
  const isCurrentUserOnCurrentPage = useMemo(() => {
    if (!currentUser) return false;
    return paginatedEntries.some((entry) => entry.userId === currentUser.id);
  }, [currentUser, paginatedEntries]);

  // Jump to user's page if user is in the filtered list
  const handleJumpToMyRank = () => {
    if (!currentUser) return;
    const userIdx = filteredLeaderboard.findIndex((e) => e.userId === currentUser.id);
    if (userIdx !== -1) {
      const targetPage = Math.floor(userIdx / pageSize) + 1;
      setCurrentPage(targetPage);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Header & Global Actions */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F27D26]/10 border border-[#F27D26]/30 text-[#F27D26]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-serif tracking-tight flex items-center space-x-2 ${
                  isDark ? 'text-white' : 'text-zinc-950'
                }`}
              >
                <span>Top 50 Global Leaderboard</span>
              </h1>
            </div>
          </div>
          <p
            className={`mt-1 text-xs uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            Elite typists ranked strictly by lowest completion time (Top 50 Hall of Fame)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Sync Toggle */}
          <button
            id="btn-toggle-live-sync"
            onClick={() => setIsLiveAutoRefresh(!isLiveAutoRefresh)}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              isLiveAutoRefresh
                ? isDark
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : isDark
                ? 'border-white/10 bg-[#0C0C0C] text-white/40 hover:text-white'
                : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
              }`}
            />
            <span>{isLiveAutoRefresh ? 'Live Sync Active' : 'Live Sync Paused'}</span>
          </button>

          <button
            id="btn-refresh-leaderboard"
            onClick={() => fetchLeaderboardData(false)}
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
            id="btn-leaderboard-play"
            onClick={onPlayClick}
            className="flex items-center space-x-1.5 rounded-xl bg-[#F27D26] px-4 py-2 text-xs font-bold text-black shadow-md shadow-[#F27D26]/20 hover:bg-[#ff8b38] transition"
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            <span>Engage Challenge</span>
          </button>
        </div>
      </div>

      {/* Global Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* World Record */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center space-x-1 ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            <Award className="h-3.5 w-3.5 text-[#F27D26]" />
            <span>World Record</span>
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-[#F27D26]">
            {stats?.fastestTime ? `${stats.fastestTime.toFixed(2)}s` : '--'}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              isDark ? 'text-white/30' : 'text-zinc-400'
            }`}
          >
            Lowest time recorded
          </span>
        </div>

        {/* Global Average */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center space-x-1 ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            <Timer className={`h-3.5 w-3.5 ${isDark ? 'text-white/60' : 'text-zinc-600'}`} />
            <span>Average Speed</span>
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              isDark ? 'text-white/90' : 'text-zinc-900'
            }`}
          >
            {stats?.averageTime ? `${stats.averageTime.toFixed(2)}s` : '--'}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              isDark ? 'text-white/30' : 'text-zinc-400'
            }`}
          >
            Global benchmark
          </span>
        </div>

        {/* Matches Run */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center space-x-1 ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span>Total Matches</span>
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              isDark ? 'text-white/90' : 'text-zinc-900'
            }`}
          >
            {stats?.totalGamesPlayed || 0}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              isDark ? 'text-white/30' : 'text-zinc-400'
            }`}
          >
            Speed tests completed
          </span>
        </div>

        {/* User's Personal Standing Card */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            currentUser && (myRank || currentUser.bestScore)
              ? isDark
                ? 'border-[#F27D26]/40 bg-[#F27D26]/10'
                : 'border-[#F27D26]/30 bg-amber-50/70'
              : isDark
              ? 'border-white/10 bg-[#080808]'
              : 'border-zinc-200 bg-white shadow-xs'
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.15em] flex items-center space-x-1 ${
              currentUser && (myRank || currentUser.bestScore)
                ? 'text-[#F27D26]'
                : isDark
                ? 'text-white/40'
                : 'text-zinc-500'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Your Global Rank</span>
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              currentUser && (myRank || currentUser.bestScore)
                ? 'text-[#F27D26]'
                : isDark
                ? 'text-white/50'
                : 'text-zinc-400'
            }`}
          >
            {currentUser
              ? myRank
                ? `#${myRank.rank}`
                : currentUser.bestScore
                ? `#${leaderboard.findIndex((e) => e.userId === currentUser.id) + 1 || '--'}`
                : 'Unranked'
              : 'Guest'}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              currentUser && (myRank || currentUser.bestScore)
                ? isDark
                  ? 'text-white/60'
                  : 'text-zinc-600'
                : isDark
                ? 'text-white/30'
                : 'text-zinc-400'
            }`}
          >
            {currentUser
              ? myRank?.bestTime
                ? `Best: ${myRank.bestTime.toFixed(2)}s`
                : currentUser.bestScore
                ? `Best: ${currentUser.bestScore.toFixed(2)}s`
                : 'Complete a match'
              : 'Sign in to rank'}
          </span>
        </div>
      </div>

      {/* User's Standing Callout Banner (when logged in & not currently in top view or outside top 50) */}
      {currentUser && myRank && (
        <div
          id="user-standing-banner"
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-md ${
            isDark
              ? 'border-[#F27D26]/40 bg-[#0F0A05] text-white'
              : 'border-[#F27D26]/30 bg-amber-50/80 text-zinc-900'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F27D26] text-black font-bold font-mono text-xs shadow-xs">
              #{myRank.rank}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm">{currentUser.username}</span>
                <span className="rounded bg-[#F27D26]/20 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-[#F27D26] border border-[#F27D26]/30">
                  YOUR STANDING
                </span>
                {myRank.rank <= 50 ? (
                  <span className="text-xs text-emerald-400 font-mono flex items-center space-x-1">
                    <Flame className="h-3 w-3 inline" />
                    <span>Top 50 Typist</span>
                  </span>
                ) : (
                  <span className={`text-xs font-mono ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
                    Rank {myRank.rank} of {stats?.totalUsers || 50}+ typists
                  </span>
                )}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-white/50' : 'text-zinc-600'}`}>
                Personal Best: <strong className="text-[#F27D26]">{myRank.bestTime.toFixed(2)}s</strong> •{' '}
                Total Matches: {myRank.totalGames}
              </div>
            </div>
          </div>

          {myRank.rank <= 50 && !isCurrentUserOnCurrentPage && (
            <button
              id="btn-jump-to-my-rank"
              onClick={handleJumpToMyRank}
              className="inline-flex items-center space-x-1 rounded-xl bg-[#F27D26]/20 border border-[#F27D26]/40 px-3 py-1.5 text-xs font-semibold text-[#F27D26] hover:bg-[#F27D26] hover:text-black transition"
            >
              <span>Jump to My Page</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Controls Bar: Search & Page Size */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
              isDark ? 'text-white/40' : 'text-zinc-400'
            }`}
          />
          <input
            id="input-search-leaderboard"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Top 50 players by username..."
            className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
              isDark
                ? 'border-white/10 bg-[#080808] text-white placeholder-white/30'
                : 'border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
            }`}
          />
        </div>

        {/* Page Size Selector & Entries Count */}
        <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs font-mono">
          <span className={`${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
            Show:
          </span>
          <div
            className={`flex items-center space-x-1 rounded-xl border p-1 ${
              isDark ? 'border-white/10 bg-[#060606]' : 'border-zinc-200 bg-zinc-100'
            }`}
          >
            {[10, 25, 50].map((size) => (
              <button
                key={size}
                id={`btn-page-size-${size}`}
                onClick={() => setPageSize(size)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  pageSize === size
                    ? 'bg-[#F27D26] text-black shadow-xs font-bold'
                    : isDark
                    ? 'text-white/40 hover:text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
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
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">Player</th>
                <th className="py-3.5 px-4 text-right">Best Time</th>
                <th className="py-3.5 px-4 text-right hidden sm:table-cell">Total Games</th>
                <th className="py-3.5 px-4 text-right hidden md:table-cell">Last Active</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-zinc-100'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className={`py-12 text-center ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-[#F27D26]" />
                      <span className="text-xs uppercase tracking-wider">Loading top 50 rankings...</span>
                    </div>
                  </td>
                </tr>
              ) : errorMessage && filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <span className="text-rose-500">{errorMessage}</span>
                      <button
                        id="btn-retry-leaderboard"
                        type="button"
                        onClick={() => fetchLeaderboardData(false)}
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
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                        isDark ? 'border-white/10 bg-white/5 text-white/30' : 'border-zinc-200 bg-zinc-100 text-zinc-400'
                      }`}>
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {searchQuery ? `No players found matching "${searchQuery}"` : 'No Records on Global Leaderboard Yet'}
                      </div>
                      <p className={`text-xs max-w-sm ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>
                        {searchQuery
                          ? 'Try searching with a different typist handle or clear the filter.'
                          : 'Be the first typist to complete the speed challenge and claim Rank #1!'}
                      </p>
                      {!searchQuery && (
                        <button
                          id="btn-empty-play"
                          type="button"
                          onClick={onPlayClick}
                          className="mt-2 inline-flex items-center space-x-2 rounded-xl bg-[#F27D26] px-4 py-2 text-xs font-bold text-black shadow-md shadow-[#F27D26]/20 hover:bg-[#ff8b38] transition"
                        >
                          <Zap className="h-4 w-4 fill-current" />
                          <span>Set First High Score</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const isCurrent = currentUser && currentUser.id === entry.userId;
                  return (
                    <tr
                      key={entry.userId}
                      id={`leaderboard-row-${entry.rank}`}
                      className={`transition ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-zinc-50'
                      } ${
                        isCurrent
                          ? isDark
                            ? 'bg-[#F27D26]/10 border-l-4 border-l-[#F27D26]'
                            : 'bg-amber-50/80 border-l-4 border-l-[#F27D26]'
                          : ''
                      }`}
                    >
                      {/* Rank Icon / Number */}
                      <td className="py-4 px-4 text-center font-bold">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/40 text-xs font-mono font-extrabold shadow-sm shadow-[#F27D26]/20">
                            01
                          </span>
                        ) : entry.rank === 2 ? (
                          <span
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-full border text-xs font-mono font-bold ${
                              isDark
                                ? 'bg-white/10 text-white/90 border-white/20'
                                : 'bg-zinc-200 text-zinc-800 border-zinc-300'
                            }`}
                          >
                            02
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-900/30 text-amber-500 border border-amber-800/40 text-xs font-mono font-bold">
                            03
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-xs ${
                              isDark ? 'text-white/40' : 'text-zinc-400'
                            }`}
                          >
                            {entry.rank.toString().padStart(2, '0')}
                          </span>
                        )}
                      </td>

                      {/* Player */}
                      <td className={`py-4 px-4 font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        <div className="flex items-center space-x-2">
                          <span className="tracking-tight">{entry.player}</span>
                          {isCurrent && (
                            <span className="rounded bg-[#F27D26]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-[#F27D26] border border-[#F27D26]/30">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Best Time (e.g. 8.42s) */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-mono font-bold text-base text-[#F27D26]">
                          {entry.bestTime.toFixed(2)}s
                        </span>
                      </td>

                      {/* Total Games */}
                      <td
                        className={`py-4 px-4 text-right font-mono text-xs hidden sm:table-cell ${
                          isDark ? 'text-white/50' : 'text-zinc-500'
                        }`}
                      >
                        {entry.totalGames}
                      </td>

                      {/* Last Active */}
                      <td
                        className={`py-4 px-4 text-right text-xs font-mono hidden md:table-cell ${
                          isDark ? 'text-white/40' : 'text-zinc-400'
                        }`}
                      >
                        {new Date(entry.lastPlayed).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pinned Sticky User Rank (if user is outside current page or beyond top 50) */}
        {currentUser && myRank && !isCurrentUserOnCurrentPage && (
          <div
            id="pinned-user-rank-row"
            className={`border-t flex items-center justify-between px-4 py-3 text-xs font-mono ${
              isDark
                ? 'border-[#F27D26]/30 bg-[#120B04] text-white'
                : 'border-[#F27D26]/30 bg-amber-50 text-zinc-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F27D26] text-black font-bold text-[11px]">
                #{myRank.rank}
              </span>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">{currentUser.username}</span>
                <span className="rounded bg-[#F27D26]/20 px-1 py-0.5 text-[8px] font-bold uppercase text-[#F27D26] border border-[#F27D26]/30">
                  YOU
                </span>
                <span className={`text-[11px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
                  (Current Overall Standing)
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="font-bold text-sm text-[#F27D26]">{myRank.bestTime.toFixed(2)}s</span>
              </div>
              {myRank.rank <= 50 && (
                <button
                  onClick={handleJumpToMyRank}
                  className="rounded-lg bg-[#F27D26]/20 border border-[#F27D26]/40 px-2.5 py-1 text-[11px] font-semibold text-[#F27D26] hover:bg-[#F27D26] hover:text-black transition"
                >
                  View on Page
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-3 text-xs font-mono ${
            isDark ? 'border-white/10 bg-[#050505] text-white/50' : 'border-zinc-200 bg-zinc-50 text-zinc-600'
          }`}
        >
          {/* Entries Info */}
          <div>
            Showing <strong className={isDark ? 'text-white' : 'text-zinc-900'}>{totalItems > 0 ? startIndex + 1 : 0}</strong> to{' '}
            <strong className={isDark ? 'text-white' : 'text-zinc-900'}>{endIndex}</strong> of{' '}
            <strong className={isDark ? 'text-white' : 'text-zinc-900'}>{totalItems}</strong> entries (Top 50)
          </div>

          {/* Page Navigation Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              id="btn-prev-page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`flex items-center space-x-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isDark
                  ? 'border-white/10 bg-[#0A0A0A] text-white/70 hover:bg-white/10 hover:text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 shadow-xs'
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                id={`btn-page-${p}`}
                onClick={() => setCurrentPage(p)}
                className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                  safePage === p
                    ? 'bg-[#F27D26] text-black shadow-xs font-bold'
                    : isDark
                    ? 'border border-white/5 bg-[#0A0A0A] text-white/50 hover:text-white hover:bg-white/10'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              id="btn-next-page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`flex items-center space-x-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isDark
                  ? 'border-white/10 bg-[#0A0A0A] text-white/70 hover:bg-white/10 hover:text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 shadow-xs'
              }`}
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
