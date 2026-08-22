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
  }): { result: DBGameResult; isNewBestScore: boolean } {
    const user = this.findUserById(params.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const penaltyTime = Number((params.wrongAttempts * 0.5).toFixed(2));
    const totalTime = Number((params.rawTime + penaltyTime).toFixed(2));
    const correctChars = params.correctChars || 20;

    // Check if new best score (lower completion time is better score)
    const isNewBestScore = user.bestScore === null || totalTime < user.bestScore;

    if (isNewBestScore) {
      user.bestScore = totalTime;
      this.users.set(user.id, user);
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

    return { result: gameResult, isNewBestScore };
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

  // Leaderboard with best score per player (Rank, Player, Best Time)
  public getLeaderboard(limit = 20): LeaderboardEntry[] {
    const userBestMap = new Map<string, { user: DBUser; bestGame: DBGameResult; count: number }>();

    for (const game of this.gameResults) {
      const user = this.findUserById(game.userId);
      if (!user) continue;

      const existing = userBestMap.get(game.userId);
      if (!existing) {
        userBestMap.set(game.userId, { user, bestGame: game, count: 1 });
      } else {
        existing.count += 1;
        if (game.totalTime < existing.bestGame.totalTime) {
          existing.bestGame = game;
        }
      }
    }

    // Sort ascending by bestTime (lower time = higher rank)
    const sorted = Array.from(userBestMap.values()).sort(
      (a, b) => a.bestGame.totalTime - b.bestGame.totalTime
    );

    return sorted.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      userId: entry.user.id,
      player: entry.user.username,
      bestTime: entry.bestGame.totalTime,
      totalGames: entry.count,
      lastPlayed: entry.bestGame.createdAt,
    }));
  }

  // Get specific user's rank across all players
  public getUserRank(userId: string): LeaderboardEntry | null {
    const userBestMap = new Map<string, { user: DBUser; bestGame: DBGameResult; count: number }>();

    for (const game of this.gameResults) {
      const user = this.findUserById(game.userId);
      if (!user) continue;

      const existing = userBestMap.get(game.userId);
      if (!existing) {
        userBestMap.set(game.userId, { user, bestGame: game, count: 1 });
      } else {
        existing.count += 1;
        if (game.totalTime < existing.bestGame.totalTime) {
          existing.bestGame = game;
        }
      }
    }

    const sorted = Array.from(userBestMap.values()).sort(
      (a, b) => a.bestGame.totalTime - b.bestGame.totalTime
    );

    const index = sorted.findIndex((e) => e.user.id === userId);
    if (index === -1) return null;

    const entry = sorted[index];
    return {
      rank: index + 1,
      userId: entry.user.id,
      player: entry.user.username,
      bestTime: entry.bestGame.totalTime,
      totalGames: entry.count,
      lastPlayed: entry.bestGame.createdAt,
    };
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
