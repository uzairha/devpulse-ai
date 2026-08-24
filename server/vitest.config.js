import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const envTestPath = path.join(rootDir, '.env.test');

if (!fs.existsSync(envTestPath)) {
  throw new Error('Missing server/.env.test — copy .env.test.example to .env.test before running tests.');
}

// Passed through `test.env` rather than loaded here, so the values are applied
// inside the test workers before config/index.js reads process.env. dotenv does
// not overwrite variables that are already set, so the dev `.env` loaded by
// config/index.js can only fill in keys that .env.test leaves out.
const testEnv = dotenv.parse(fs.readFileSync(envTestPath));

export default defineConfig({
  test: {
    environment: 'node',
    env: testEnv,
    setupFiles: ['./src/test/setup.js'],
    // Integration tests share one database and truncate it between tests, so two
    // files running concurrently would delete each other's rows mid-test.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
