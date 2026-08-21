import { createYoga } from 'graphql-yoga';
import { schema } from './schema.js';
import { verifyToken } from './auth.js';
import { db } from './db.js';
import { AuthContext } from './types.js';

export const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  maskedErrors: false,
  context: async ({ request, req }: { request?: Request; req?: any }): Promise<AuthContext> => {
    let authHeader = '';

    if (request && request.headers) {
      authHeader = request.headers.get('authorization') || '';
    } else if (req && req.headers) {
      authHeader = req.headers.authorization || '';
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        const user = db.upsertUserFromToken(decoded);
        if (user) {
          return { user };
        }
      }
    }

    return { user: null };
  },
});

