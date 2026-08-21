export interface DBUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  bestScore: number | null; // in seconds
}

export interface DBGameResult {
  id: string;
  userId: string;
  username: string;
  totalTime: number; // in seconds (rawTime + penaltyTime)
  rawTime: number; // in seconds
  penaltyTime: number; // in seconds
  correctChars: number; // usually 20
  wrongAttempts: number;
  sequence: string;
  isNewBestScore: boolean;
  createdAt: string;
}

export interface AuthContext {
  user: DBUser | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  player: string; // username
  bestTime: number; // in seconds (e.g. 8.42)
  totalGames: number;
  lastPlayed: string;
}

export interface GlobalStats {
  totalGamesPlayed: number;
  totalUsers: number;
  fastestTime: number | null;
  averageTime: number | null;
}
