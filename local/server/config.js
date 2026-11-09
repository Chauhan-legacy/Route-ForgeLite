/**
 * RouteForge - Local Server Configuration
 */
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  storageType: process.env.STORAGE || 'memory', // 'memory' | 'sqlite'
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, 'routeforge.sqlite'),
  authMode: process.env.AUTH_MODE || 'none', // 'none' | 'shared-secret'
  sharedSecret: process.env.SHARED_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

