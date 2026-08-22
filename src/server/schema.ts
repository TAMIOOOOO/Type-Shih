import { createSchema } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { db } from './db.js';
import { hashPassword, verifyPassword, generateToken } from './auth.js';
import { AuthContext } from './types.js';

export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    email: String!
    username: String!
    bestScore: Float
    createdAt: String!
    gameCount: Int!
  }

  type GameResult {
    id: ID!
    userId: String!
    username: String!
    totalTime: Float!
    rawTime: Float!
    penaltyTime: Float!
    correctChars: Int!
    wrongAttempts: Int!
    sequence: String!
    isNewBestScore: Boolean!
    createdAt: String!
  }

  type LeaderboardEntry {
    rank: Int!
    userId: String!
    player: String!
    bestTime: Float!
    rawTime: Float
    penaltyTime: Float
    wrongAttempts: Int
    accuracy: Float
    wpm: Float
    totalGames: Int!
    lastPlayed: String!
  }

  type GlobalStats {
    totalGamesPlayed: Int!
    totalUsers: Int!
    fastestTime: Float
    averageTime: Float
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type GameResultPayload {
    gameResult: GameResult!
    isNewBestScore: Boolean!
    userBestScore: Float
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  input LoginInput {
    login: String! # username or email
    password: String!
  }

  input GameResultInput {
    rawTime: Float!
    wrongAttempts: Int!
    sequence: String!
    correctChars: Int
  }

  type Query {
    me: User
    gameHistory(limit: Int): [GameResult!]!
    userBestScore: GameResult
    leaderboard(limit: Int, timeframe: String): [LeaderboardEntry!]!
    myRank(timeframe: String): LeaderboardEntry
    stats: GlobalStats!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    saveGameResult(input: GameResultInput!): GameResultPayload!
  }
`;

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.user) return null;
      const user = db.findUserById(context.user.id);
      if (!user) return null;
      const history = db.getUserGameHistory(user.id);
      return {
        ...user,
        gameCount: history.length,
      };
    },

    gameHistory: (_: unknown, { limit }: { limit?: number }, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required to view game history', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      return db.getUserGameHistory(context.user.id, limit || 50);
    },

    userBestScore: (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required to view best score', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      return db.getUserBestScore(context.user.id);
    },

    leaderboard: (
      _: unknown,
      { limit, timeframe }: { limit?: number; timeframe?: 'ALL_TIME' | 'TODAY' | 'WEEK' | 'MONTH' }
    ) => {
      return db.getLeaderboard(limit || 50, timeframe || 'ALL_TIME');
    },

    myRank: (
      _: unknown,
      { timeframe }: { timeframe?: 'ALL_TIME' | 'TODAY' | 'WEEK' | 'MONTH' },
      context: AuthContext
    ) => {
      if (!context.user) return null;
      return db.getUserRank(context.user.id, timeframe || 'ALL_TIME');
    },

    stats: () => {
      return db.getGlobalStats();
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      { input }: { input: { username: string; email: string; password: string } }
    ) => {
      const trimmedUsername = (input.username || '').trim();
      const trimmedEmail = (input.email || '').trim().toLowerCase();
      const password = input.password || '';

      if (!trimmedUsername || trimmedUsername.length < 2) {
        throw new GraphQLError('Typist handle must be at least 2 characters long', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        throw new GraphQLError('Typist handle can only contain alphanumeric characters, underscores, and hyphens', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new GraphQLError('Please provide a valid email address', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (!password || password.length < 6) {
        throw new GraphQLError('Secret passphrase must be at least 6 characters long', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (db.findUserByEmail(trimmedEmail)) {
        throw new GraphQLError('Email address is already registered', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (db.findUserByUsername(trimmedUsername)) {
        throw new GraphQLError('Typist handle is already taken', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const passwordHash = await hashPassword(password);
      const user = db.createUser({
        username: trimmedUsername,
        email: trimmedEmail,
        passwordHash,
      });

      const token = generateToken(user);

      return {
        token,
        user: {
          ...user,
          gameCount: 0,
        },
      };
    },

    login: async (
      _: unknown,
      { input }: { input: { login: string; password: string } }
    ) => {
      const trimmedLogin = (input.login || '').trim();
      const password = input.password || '';

      if (!trimmedLogin || !password) {
        throw new GraphQLError('Login identifier and passphrase are required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let user = db.findUserByEmail(trimmedLogin);
      if (!user) {
        user = db.findUserByUsername(trimmedLogin);
      }

      if (!user) {
        throw new GraphQLError('Invalid credentials. Please verify your handle/email and passphrase.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new GraphQLError('Invalid credentials. Please verify your handle/email and passphrase.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const token = generateToken(user);
      const history = db.getUserGameHistory(user.id);

      return {
        token,
        user: {
          ...user,
          gameCount: history.length,
        },
      };
    },

    saveGameResult: (
      _: unknown,
      { input }: { input: { rawTime: number; wrongAttempts: number; sequence: string; correctChars?: number } },
      context: AuthContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required to save game results', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (input.rawTime < 0) {
        throw new GraphQLError('rawTime cannot be negative', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      if (input.wrongAttempts < 0) {
        throw new GraphQLError('wrongAttempts cannot be negative', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const { result, isNewBestScore } = db.saveGameResult({
        userId: context.user.id,
        rawTime: input.rawTime,
        wrongAttempts: input.wrongAttempts,
        sequence: input.sequence,
        correctChars: input.correctChars || 20,
      });

      const updatedUser = db.findUserById(context.user.id);

      return {
        gameResult: result,
        isNewBestScore,
        userBestScore: updatedUser?.bestScore || null,
      };
    },
  },
};

export const schema = createSchema({
  typeDefs,
  resolvers,
});
