import bcrypt from 'bcryptjs';
import { DBUser, DBGameResult, LeaderboardEntry, GlobalStats } from './types.js';

class InMemoryDB {
  private users: Map<string, DBUser> = new Map();
  private gameResults: DBGameResult[] = [];

  constructor() {
    this.seedInitialData();
  }

  private async seedInitialData() {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 6);

    // Initial users corresponding to the assignment problem statement example
    const seedUsers = [
      { id: 'user-alex', username: 'Alex', email: 'alex@example.com', bestScore: 8.42 },
      { id: 'user-john', username: 'John', email: 'john@example.com', bestScore: 9.15 },
      { id: 'user-sarah', username: 'Sarah', email: 'sarah@example.com', bestScore: 9.87 },
      { id: 'user-emily', username: 'Emily', email: 'emily@example.com', bestScore: 10.45 },
      { id: 'user-michael', username: 'Michael', email: 'michael@example.com', bestScore: 11.20 },
    ];

    for (const u of seedUsers) {
      const user: DBUser = {
        id: u.id,
        username: u.username,
        email: u.email,
        passwordHash: defaultPasswordHash,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        bestScore: u.bestScore,
      };
      this.users.set(user.id, user);

      // Seed historical game result for leaderboard
      this.gameResults.push({
        id: `game-${u.id}-1`,
        userId: u.id,
        username: u.username,
        totalTime: u.bestScore,
        rawTime: Number((u.bestScore - 0.5).toFixed(2)),
        penaltyTime: 0.5,
        correctChars: 20,
        wrongAttempts: 1,
        sequence: 'WZXKLPQRMBNTAFGHJKLY',
        isNewBestScore: true,
        createdAt: new Date(Date.now() - 3600000 * Math.floor(Math.random() * 24 + 1)).toISOString(),
      });
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
