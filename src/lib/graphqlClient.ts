import { graphql } from 'graphql';
import { schema } from '../server/schema.js';
import { db } from '../server/db.js';
import { verifyToken } from '../server/auth.js';

const TOKEN_KEY = 'typing_speed_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  clearGraphQLCache();
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  clearGraphQLCache();
}

// In-Memory Query Cache & In-Flight Request Deduplication
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export function clearGraphQLCache(): void {
  queryCache.clear();
  inFlightRequests.clear();
}

export function invalidateGraphQLCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
}

export interface ExecuteOptions {
  skipCache?: boolean;
  forceRefresh?: boolean;
  ttlMs?: number;
  retries?: number;
}

async function executeLocalGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const token = getAuthToken();
  let user = null;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.userId) {
      user = db.upsertUserFromToken(decoded);
    }
  }

  const result = await graphql({
    schema,
    source: query,
    variableValues: variables,
    contextValue: { user },
  });

  if (result.errors && result.errors.length > 0) {
    const message = result.errors[0]?.message || 'GraphQL execution failed';
    throw new Error(message);
  }

  return (result.data as unknown) as T;
}

export async function executeGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {},
  optionsOrRetries?: ExecuteOptions | number
): Promise<T> {
  const options: ExecuteOptions =
    typeof optionsOrRetries === 'number'
      ? { retries: optionsOrRetries }
      : optionsOrRetries || {};

  const retries = options.retries ?? 1;
  const isMutation = query.trim().startsWith('mutation');
  const token = getAuthToken();

  // Create unique cache key for queries
  const cacheKey = `${query.replace(/\s+/g, ' ').trim()}::${JSON.stringify(variables)}::${token || 'guest'}`;

  // If this is a mutation, invalidate query cache to guarantee fresh state
  if (isMutation) {
    clearGraphQLCache();
  } else if (!options.forceRefresh && !options.skipCache) {
    // 1. Check in-memory cache
    const cached = queryCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }

    // 2. Check in-flight deduplication promise
    const existingPromise = inFlightRequests.get(cacheKey);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }
  }

  const fetchPromise = (async (): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables }),
        });

        if (response.status === 404 || response.status === 405 || response.status === 502) {
          // Server endpoint not active on static preview host -> fallback for this request
          return await executeLocalGraphQL<T>(query, variables);
        }

        let json: any = {};
        try {
          json = await response.json();
        } catch (err) {
          if (!response.ok) {
            return await executeLocalGraphQL<T>(query, variables);
          }
          throw new Error('Failed to parse response from server');
        }

        if (json && Array.isArray(json.errors) && json.errors.length > 0) {
          const message = json.errors[0]?.message || 'GraphQL execution failed';
          throw new Error(message);
        }

        return json ? (json.data as T) : (null as unknown as T);
      } catch (err: any) {
        lastError = err;
        if (
          err?.name === 'TypeError' ||
          (err?.message && (err.message.includes('fetch') || err.message.includes('Failed to fetch')))
        ) {
          return await executeLocalGraphQL<T>(query, variables);
        }
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    // If network calls fail, gracefully fall back to local direct engine for this invocation
    try {
      return await executeLocalGraphQL<T>(query, variables);
    } catch (fallbackErr) {
      throw lastError || fallbackErr || new Error('GraphQL request failed');
    }
  })();

  if (!isMutation && !options.skipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  try {
    const result = await fetchPromise;

    // Cache the resolved result for queries
    if (!isMutation && !options.skipCache && result) {
      queryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: options.ttlMs || 45000, // 45 seconds default TTL
      });
    }

    return result;
  } finally {
    if (!isMutation && !options.skipCache) {
      inFlightRequests.delete(cacheKey);
    }
  }
}

// Queries and Mutations
export const ME_QUERY = /* GraphQL */ `
  query GetMe {
    me {
      id
      email
      username
      bestScore
      createdAt
      gameCount
    }
  }
`;

export const LEADERBOARD_QUERY = /* GraphQL */ `
  query GetLeaderboard($limit: Int, $timeframe: String) {
    leaderboard(limit: $limit, timeframe: $timeframe) {
      rank
      userId
      player
      bestTime
      rawTime
      penaltyTime
      wrongAttempts
      accuracy
      wpm
      totalGames
      lastPlayed
    }
    myRank(timeframe: $timeframe) {
      rank
      userId
      player
      bestTime
      rawTime
      penaltyTime
      wrongAttempts
      accuracy
      wpm
      totalGames
      lastPlayed
    }
  }
`;

export const GAME_HISTORY_QUERY = /* GraphQL */ `
  query GetGameHistory($limit: Int) {
    gameHistory(limit: $limit) {
      id
      userId
      username
      totalTime
      rawTime
      penaltyTime
      correctChars
      wrongAttempts
      sequence
      isNewBestScore
      createdAt
    }
  }
`;

export const USER_BEST_SCORE_QUERY = /* GraphQL */ `
  query GetUserBestScore {
    userBestScore {
      id
      totalTime
      rawTime
      penaltyTime
      wrongAttempts
      createdAt
    }
  }
`;

export const STATS_QUERY = /* GraphQL */ `
  query GetStats {
    stats {
      totalGamesPlayed
      totalUsers
      fastestTime
      averageTime
    }
  }
`;

export const REGISTER_MUTATION = /* GraphQL */ `
  mutation RegisterUser($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        email
        username
        bestScore
        createdAt
        gameCount
      }
    }
  }
`;

export const LOGIN_MUTATION = /* GraphQL */ `
  mutation LoginUser($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        email
        username
        bestScore
        createdAt
        gameCount
      }
    }
  }
`;

export const SAVE_GAME_MUTATION = /* GraphQL */ `
  mutation SaveGameResult($input: GameResultInput!) {
    saveGameResult(input: $input) {
      gameResult {
        id
        userId
        username
        totalTime
        rawTime
        penaltyTime
        correctChars
        wrongAttempts
        sequence
        isNewBestScore
        createdAt
      }
      isNewBestScore
      isLeaderboardBeaten
      userBestScore
      prevRank
      newRank
    }
  }
`;
