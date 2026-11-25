/**
 * tests/run-collection.js
 *
 * Boots the real Express app against the configured database, then runs the
 * Postman collection with Newman and prints the summary. This is the same suite
 * you would run in the Postman app, just automated:
 *
 *   npm test
 *
 * Exit code is 0 only when every assertion passes.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '5000';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const newman = require('newman');
const mongoose = require('mongoose');

const app = require('../src/app');
const connectDB = require('../src/config/db');

const COLLECTION = path.join(__dirname, '..', 'postman', 'Campus-Lost-Found.postman_collection.json');
const ENVIRONMENT = path.join(__dirname, '..', 'postman', 'Campus-Lost-Found.postman_environment.json');
const PORT = Number(process.env.TEST_PORT) || 5099;

(async () => {
  await connectDB();

  const server = await new Promise((resolve) => {
    const instance = app.listen(PORT, '127.0.0.1', () => resolve(instance));
  });

  const environment = JSON.parse(fs.readFileSync(ENVIRONMENT, 'utf8'));
  const baseUrl = `http://127.0.0.1:${PORT}`;
  environment.values = environment.values.map((entry) =>
    entry.key === 'baseUrl' ? { ...entry, value: baseUrl } : entry
  );

  const failures = [];

  await new Promise((resolve) => {
    newman.run(
      {
        collection: JSON.parse(fs.readFileSync(COLLECTION, 'utf8')),
        environment,
        reporters: ['cli'],
        reporter: { cli: { noSummary: false } },
      },
      (error, summary) => {
        if (error) {
          failures.push(error.message);
          return resolve();
        }
        summary.run.executions.forEach((execution) => {
          (execution.assertions || []).forEach((assertion) => {
            if (assertion.error) {
              failures.push(`${execution.item.name} :: ${assertion.assertion} - ${assertion.error.message}`);
            }
          });
          if (execution.requestError) {
            failures.push(`${execution.item.name} :: request error - ${execution.requestError.message}`);
          }
        });
        return resolve();
      }
    );
  });

  if (failures.length) {
    console.log(`\n${failures.length} assertion(s) failed:`);
    failures.forEach((line) => console.log(`  - ${line}`));
  } else {
    console.log('\nAll Postman assertions passed.');
  }

  server.close();
  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
})().catch(async (error) => {
  console.error('Test run failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
