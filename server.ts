import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { yoga } from './src/server/yoga.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Bind GraphQL Yoga directly (BEFORE body parsers so request stream is not consumed)
  app.use(yoga.graphqlEndpoint, yoga as any);
  app.use('/graphql', yoga as any);

  // JSON parser for other general endpoints
  app.use(express.json());

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Typing Speed Challenge GraphQL Yoga Server',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Typing Speed Game Server running on http://localhost:${PORT}`);
    console.log(`📊 GraphQL Yoga API Explorer: http://localhost:${PORT}/api/graphql`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
