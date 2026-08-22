import bcrypt from 'bcryptjs';
import { DBUser, DBGameResult, LeaderboardEntry, GlobalStats } from './types.js';

// Legacy mock user IDs to purge
const MOCK_USER_IDS = new Set(['user-alex', 'user-john', 'user-sarah', 'user-emily', 'user-michael']);

function getNodeFs() {
  if (typeof window !== 'undefined') return null;
  try {
    // Safely load Node fs without bundler warnings
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Function('return typeof require !== "undefined" ? require("fs") : null')();
  } catch {
    return null;
  }
}

function getNodePath() {
  if (typeof window !== 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Function('return typeof require !== "undefined" ? require("path") : null')();
  } catch {
    return null;
  }
}

class InMemoryDB {
  private users: Map<string, DBUser> = new Map();
  private gameResults: DBGameResult[] = [];
  private storageFilePath: string | null = null;

  constructor() {
    this.initStoragePath();
    this.loadFromStorage();
  }

  private initStoragePath() {
    if (typeof window === 'undefined') {
      const pathModule = getNodePath();
      if (pathModule) {
        this.storageFilePath = pathModule.join(process.cwd(), '.data', 'typing_game_db.json');
      }
    }
  }

  private loadFromStorage() {
    // 1. If running on Node.js server, load from durable file store
    if (typeof window === 'undefined') {
      const fsModule = getNodeFs();
      if (fsModule && this.storageFilePath) {
        try {
          if (fsModule.existsSync(this.storageFilePath)) {
            const raw = fsModule.readFileSync(this.storageFilePath, 'utf-8');
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.users)) {
              for (const u of data.users) {
                if (!MOCK_USER_IDS.has(u.id)) {
                  this.users.set(u.id, u);
                }
              }
            }
            if (data && Array.isArray(data.gameResults)) {
              this.gameResults = data.gameResults.filter((g: DBGameResult) => !MOCK_USER_IDS.has(g.userId));
            }
            return;
          }
        } catch (err) {
          console.warn('Could not load from Node storage file:', err);
        }
      }
      return;
    }

    // 2. If running in browser, load from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedUsers = localStorage.getItem('typing_speed_db_users');
        const savedGames = localStorage.getItem('typing_speed_db_games');

        if (savedUsers) {
          const parsedUsers: DBUser[] = JSON.parse(savedUsers);
          for (const u of parsedUsers) {
            if (!MOCK_USER_IDS.has(u.id)) {
              this.users.set(u.id, u);
            }
          }
        }
        if (savedGames) {
          const parsedGames: DBGameResult[] = JSON.parse(savedGames);
          this.gameResults = parsedGames.filter((g) => !MOCK_USER_IDS.has(g.userId));
        }

        // Clean any cached mock entries from localStorage
        this.saveToStorage();
      } catch (err) {
        console.warn('Could not load from browser localStorage:', err);
      }
    }
  }

  private saveToStorage() {
    // 1. If running on Node.js server, save to durable file store
    if (typeof window === 'undefined') {
      const fsModule = getNodeFs();
      const pathModule = getNodePath();
      if (fsModule && pathModule && this.storageFilePath) {
        try {
          const dir = pathModule.dirname(this.storageFilePath);
          if (!fsModule.existsSync(dir)) {
            fsModule.mkdirSync(dir, { recursive: true });
          }
          const payload = JSON.stringify(
            {
              users: Array.from(this.users.values()),
              gameResults: this.gameResults,
              lastUpdated: new Date().toISOString(),
            },
            null,
            2
          );
          fsModule.writeFileSync(this.storageFilePath, payload, 'utf-8');
        } catch (err) {
          console.warn('Could not save to Node storage file:', err);
        }
      }
      return;
    }

    // 2. If running in browser, save to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(
          'typing_speed_db_users',
          JSON.stringify(Array.from(this.users.values()))
        );
        localStorage.setItem('typing_speed_db_games', JSON.stringify(this.gameResults));
      } catch (err) {
        console.warn('Could not save to browser localStorage:', err);
      }
    }
  }

  // User queries
  public findUserById(id: string): DBUser | null {
    return this.users.get(id) || null;
  }

  public findUserByEmail(email: string): DBUser | null {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  public findUserByUsername(username: string): DBUser | null {
    const normalized = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  public createUser(user: Omit<DBUser, 'id' | 'createdAt' | 'bestScore'>): DBUser {
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newUser: DBUser = {
      ...user,
      id,
      createdAt: new Date().toISOString(),
      bestScore: null,
    };
    this.users.set(id, newUser);
    this.saveToStorage();
    return newUser;
  }

  public upsertUserFromToken(decoded: { userId: string; username?: string; email?: string }): DBUser {
    const existing = this.findUserById(decoded.userId);
    if (existing) return existing;

    const username = decoded.username || `User_${decoded.userId.slice(-4)}`;
    const email = decoded.email || `${username.toLowerCase()}@local.dev`;

    const newUser: DBUser = {
      id: decoded.userId,
      username,
      email,
      passwordHash: '',
      createdAt: new Date().toISOString(),
      bestScore: null,
    };
    this.users.set(decoded.userId, newUser);
    this.saveToStorage();
    return newUser;
  }

  // Game Result operations
  public saveGameResult(params: {
    userId: string;
    rawTime: number;
    wrongAttempts: number;
    sequence: string;
    correctChars?: number;
  }): {
    result: DBGameResult;
    isNewBestScore: boolean;
    isLeaderboardBeaten: boolean;
    prevRank: number | null;
    newRank: number | null;
  } {
    const user = this.findUserById(params.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const penaltyTime = Number((params.wrongAttempts * 0.5).toFixed(2));
    const totalTime = Number((params.rawTime + penaltyTime).toFixed(2));
    const correctChars = params.correctChars || 20;

    // Check if new best score (lower completion time is better score)
    const isNewBestScore = user.bestScore === null || totalTime < user.bestScore;
    const prevRank = this.getUserRank(user.id)?.rank ?? null;

    // Check if this score beats someone else's high score on the leaderboard
    let isLeaderboardBeaten = false;

    if (isNewBestScore) {
      user.bestScore = totalTime;
      this.users.set(user.id, user);

      // Check if there is another player whose best score was beaten by this time
      const otherUsers = Array.from(this.users.values()).filter(
        (u) => u.id !== user.id && u.bestScore !== null
      );
      const hasBeatenOther = otherUsers.some((u) => totalTime < (u.bestScore as number));

      const newRank = this.getUserRank(user.id)?.rank ?? null;
      isLeaderboardBeaten =
        hasBeatenOther ||
        (prevRank !== null && newRank !== null && newRank < prevRank) ||
        (prevRank === null && newRank !== null && newRank <= 50);
    }

    const gameResult: DBGameResult = {
      id: `game-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      username: user.username,
      totalTime,
      rawTime: Number(params.rawTime.toFixed(2)),
      penaltyTime,
      correctChars,
      wrongAttempts: params.wrongAttempts,
      sequence: params.sequence,
      isNewBestScore,
      createdAt: new Date().toISOString(),
    };

    this.gameResults.unshift(gameResult);
    this.saveToStorage();

    const newRank = this.getUserRank(user.id)?.rank ?? null;

    return {
      result: gameResult,
      isNewBestScore,
      isLeaderboardBeaten,
      prevRank,
      newRank,
    };
  }

  // User Game History (private to user)
  public getUserGameHistory(userId: string, limit = 50): DBGameResult[] {
    return this.gameResults
      .filter((r) => r.userId === userId)
      .slice(0, limit);
  }

  // User's Best Score
  public getUserBestScore(userId: string): DBGameResult | null {
    const userGames = this.gameResults.filter((r) => r.userId === userId);
    if (userGames.length === 0) return null;

    return userGames.reduce((best, current) => {
      return current.totalTime < best.totalTime ? current : best;
    }, userGames[0]);
  }

  // Leaderboard with strictly the single best score per user (Rank, Player, Best Time, Accuracy, WPM)
  public getLeaderboard(
    limit = 50,
    timeframe: 'ALL_TIME' | 'TODAY' | 'WEEK' | 'MONTH' = 'ALL_TIME'
  ): LeaderboardEntry[] {
    const now = Date.now();
    let timeframeCutoff = 0;
    if (timeframe === 'TODAY') {
      timeframeCutoff = now - 24 * 60 * 60 * 1000;
    } else if (timeframe === 'WEEK') {
      timeframeCutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeframe === 'MONTH') {
      timeframeCutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    interface UserAgg {
      user: DBUser;
      bestGame: DBGameResult | null;
      bestTime: number;
      rawTime: number;
      penaltyTime: number;
      wrongAttempts: number;
      accuracy: number;
      wpm: number;
      count: number;
      lastPlayed: string;
      achievedAt: string;
    }

    const userBestMap = new Map<string, UserAgg>();

    for (const game of this.gameResults) {
      const user = this.findUserById(game.userId);
      if (!user) continue;

      const gameTime = new Date(game.createdAt).getTime();
      if (timeframeCutoff > 0 && gameTime < timeframeCutoff) {
        continue;
      }

      // Calculate accuracy and WPM for this game run
      const correct = game.correctChars || 20;
      const totalKeypresses = correct + (game.wrongAttempts || 0);
      const acc = totalKeypresses > 0 ? Number(((correct / totalKeypresses) * 100).toFixed(1)) : 100;
      const words = correct / 5;
      const minutes = Math.max(game.totalTime, 0.1) / 60;
      const calcWpm = Number((words / minutes).toFixed(1));

      const existing = userBestMap.get(game.userId);
      if (!existing) {
        userBestMap.set(game.userId, {
          user,
          bestGame: game,
          bestTime: game.totalTime,
          rawTime: game.rawTime,
          penaltyTime: game.penaltyTime,
          wrongAttempts: game.wrongAttempts,
          accuracy: acc,
          wpm: calcWpm,
          count: 1,
          lastPlayed: game.createdAt,
          achievedAt: game.createdAt,
        });
      } else {
        existing.count += 1;
        // Compare with existing best for this user
        // 1. Lower totalTime wins
        // 2. Tie-break: Lower penalty / wrong attempts wins
        const isBetter =
          game.totalTime < existing.bestTime ||
          (game.totalTime === existing.bestTime && game.wrongAttempts < existing.wrongAttempts);

        if (isBetter) {
          existing.bestGame = game;
          existing.bestTime = game.totalTime;
          existing.rawTime = game.rawTime;
          existing.penaltyTime = game.penaltyTime;
          existing.wrongAttempts = game.wrongAttempts;
          existing.accuracy = acc;
          existing.wpm = calcWpm;
          existing.achievedAt = game.createdAt;
        }

        if (new Date(game.createdAt) > new Date(existing.lastPlayed)) {
          existing.lastPlayed = game.createdAt;
        }
      }
    }

    // For ALL_TIME only, also consider users who have a bestScore in their profile
    if (timeframe === 'ALL_TIME') {
      for (const user of this.users.values()) {
        if (user.bestScore !== null && !userBestMap.has(user.id)) {
          const words = 20 / 5;
          const minutes = Math.max(user.bestScore, 0.1) / 60;
          const calcWpm = Number((words / minutes).toFixed(1));

          userBestMap.set(user.id, {
            user,
            bestGame: null,
            bestTime: user.bestScore,
            rawTime: user.bestScore,
            penaltyTime: 0,
            wrongAttempts: 0,
            accuracy: 100,
            wpm: calcWpm,
            count: 1,
            lastPlayed: user.createdAt,
            achievedAt: user.createdAt,
          });
        }
      }
    }

    // Sort strictly:
    // 1. bestTime ascending (lowest completion time wins rank #1)
    // 2. penaltyTime ascending (fewer mistakes / cleaner run breaks tie)
    // 3. achievedAt ascending (earlier achiever holds rank position)
    // 4. count descending (more matches played)
    const sorted = Array.from(userBestMap.values()).sort((a, b) => {
      if (a.bestTime !== b.bestTime) {
        return a.bestTime - b.bestTime;
      }
      if (a.penaltyTime !== b.penaltyTime) {
        return a.penaltyTime - b.penaltyTime;
      }
      const timeA = new Date(a.achievedAt).getTime();
      const timeB = new Date(b.achievedAt).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return b.count - a.count;
    });

    return sorted.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      userId: entry.user.id,
      player: entry.user.username,
      bestTime: entry.bestTime,
      rawTime: entry.rawTime,
      penaltyTime: entry.penaltyTime,
      wrongAttempts: entry.wrongAttempts,
      accuracy: entry.accuracy,
      wpm: entry.wpm,
      totalGames: entry.count,
      lastPlayed: entry.lastPlayed,
    }));
  }

  // Get specific user's rank across all players based on their best score
  public getUserRank(
    userId: string,
    timeframe: 'ALL_TIME' | 'TODAY' | 'WEEK' | 'MONTH' = 'ALL_TIME'
  ): LeaderboardEntry | null {
    const fullLeaderboard = this.getLeaderboard(2000, timeframe);
    const userEntry = fullLeaderboard.find((e) => e.userId === userId);
    return userEntry || null;
  }

  // Global aggregate stats
  public getGlobalStats(): GlobalStats {
    const totalGamesPlayed = this.gameResults.length;
    const totalUsers = this.users.size;

    if (totalGamesPlayed === 0) {
      return { totalGamesPlayed: 0, totalUsers, fastestTime: null, averageTime: null };
    }

    let minTime = Infinity;
    let sumTime = 0;

    for (const g of this.gameResults) {
      if (g.totalTime < minTime) minTime = g.totalTime;
      sumTime += g.totalTime;
    }

    return {
      totalGamesPlayed,
      totalUsers,
      fastestTime: minTime === Infinity ? null : Number(minTime.toFixed(2)),
      averageTime: Number((sumTime / totalGamesPlayed).toFixed(2)),
    };
  }
}

export const db = new InMemoryDB();
