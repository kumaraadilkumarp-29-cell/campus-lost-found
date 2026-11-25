/**
 * server.js - process entry point.
 * Loads environment variables, connects the database and starts listening.
 * If either step fails the process exits with a readable message instead of
 * leaving a half-started server behind.
 */
require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = Number(process.env.PORT) || 5000;

(async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      /* eslint-disable no-console */
      console.log('\n  Campus Lost & Found Portal');
      console.log(`  API + web app running at http://localhost:${PORT}`);
      console.log(`  Health check          http://localhost:${PORT}/api/health\n`);
    });

    const shutdown = (signal) => {
      console.log(`\n${signal} received, closing server...`);
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start the server:', error.message);
    process.exit(1);
  }
})();
