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

export async function executeGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {},
  retries = 1
): Promise<T> {
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

      let json: any = {};
      try {
        json = await response.json();
      } catch (err) {
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
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
      if (attempt < retries) {
        // Wait 300ms before retrying
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError || new Error('GraphQL request failed');
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
