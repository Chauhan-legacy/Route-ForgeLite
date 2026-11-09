/**
 * RouteForge - Local Node.js Express Server
 * Serves identical API contract as Target A (Apps Script) with pluggable
 * Memory or SQLite storage adapters.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const MemoryStorageAdapter = require('./storage/memory');
const SqliteStorageAdapter = require('./storage/sqlite');
const createApiRouter = require('./routes');

const app = express();

// Security: CORS & Request Limits
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Shared-secret authentication middleware (if enabled)
app.use((req, res, next) => {
  if (config.authMode === 'shared-secret' && req.path.startsWith('/api')) {
    const authHeader = req.headers['authorization'] || '';
    const secretHeader = req.headers['x-routeforge-secret'];
    const token = authHeader.replace(/^Bearer\s+/i, '') || secretHeader;

    if (token !== config.sharedSecret) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing shared authentication secret.' }
      });
    }
  }
  next();
});

// Storage Adapter selection
let storageAdapter;
if (config.storageType === 'sqlite') {
  storageAdapter = new SqliteStorageAdapter(config.sqlitePath);
} else {
  storageAdapter = new MemoryStorageAdapter();
}

// Mount API routes
app.use('/api', createApiRouter(storageAdapter));

// Serve client in production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'RouteForge API Server',
      status: 'online',
      storage: config.storageType,
      authMode: config.authMode,
      endpoints: ['/api/createRoute', '/api/getRoute', '/api/calculateRoute', '/api/optimizeRoute']
    });
  });
}

let serverInstance = null;
async function startServer(port = config.port, host = config.host) {
  await storageAdapter.init();
  return new Promise((resolve) => {
    serverInstance = app.listen(port, host, () => {
      console.log(`[RouteForge] Server listening on http://${host}:${port} (Storage: ${config.storageType})`);
      resolve(serverInstance);
    });
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('[RouteForge] Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer, storageAdapter };

