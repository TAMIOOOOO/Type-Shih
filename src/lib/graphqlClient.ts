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
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let useDirectEngine = false;

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
  retries = 1
): Promise<T> {
  if (useDirectEngine) {
    return executeLocalGraphQL<T>(query, variables);
  }

  const token = getAuthToken();
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
        // Server endpoint not active (e.g. deployed on static host like Netlify)
        useDirectEngine = true;
        return executeLocalGraphQL<T>(query, variables);
      }

      let json: any = {};
      try {
        json = await response.json();
      } catch (err) {
        if (!response.ok) {
          useDirectEngine = true;
          return executeLocalGraphQL<T>(query, variables);
        }
        throw new Error('Failed to parse response from server');
      }

      if (json && Array.isArray(json.errors) && json.errors.length > 0) {
        const message = json.errors[0]?.message || 'GraphQL execution failed';
        throw new Error(message);
      }

      return json ? json.data : null;
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'TypeError' || (err?.message && (err.message.includes('fetch') || err.message.includes('Failed to fetch')))) {
        useDirectEngine = true;
        return executeLocalGraphQL<T>(query, variables);
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  // If network calls fail, gracefully fall back to local direct engine
  try {
    useDirectEngine = true;
    return await executeLocalGraphQL<T>(query, variables);
  } catch (fallbackErr) {
    throw lastError || fallbackErr || new Error('GraphQL request failed');
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
  query GetLeaderboard($limit: Int) {
    leaderboard(limit: $limit) {
      rank
      userId
      player
      bestTime
      totalGames
      lastPlayed
    }
    myRank {
      rank
      userId
      player
      bestTime
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
      userBestScore
    }
  }
`;
