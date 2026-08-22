export type GameStatus = 'IDLE' | 'PLAYING' | 'FINISHED';
export type Theme = 'dark' | 'light';

export interface User {
  id: string;
  email: string;
  username: string;
  bestScore: number | null;
  createdAt: string;
  gameCount: number;
}

export interface GameResult {
  id: string;
  userId: string;
  username: string;
  totalTime: number;
  rawTime: number;
  penaltyTime: number;
  correctChars: number;
  wrongAttempts: number;
  sequence: string;
  isNewBestScore: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  player: string;
  bestTime: number;
  rawTime?: number;
  penaltyTime?: number;
  wrongAttempts?: number;
  accuracy?: number;
  wpm?: number;
  totalGames: number;
  lastPlayed: string;
}

export interface GlobalStats {
  totalGamesPlayed: number;
  totalUsers: number;
  fastestTime: number | null;
  averageTime: number | null;
}

export interface GameSummary {
  sequence: string;
  rawTime: number;
  penaltyTime: number;
  totalTime: number;
  wrongAttempts: number;
  correctChars: number;
  isNewBestScore: boolean;
  previousBest: number | null;
  accuracy: number;
  cps: number; // characters per second
}
