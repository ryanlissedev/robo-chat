import fs from 'node:fs/promises';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  try {
    // Clean up any temporary files created during tests
    const tempFiles = [
      './tests/e2e/auth.json',
      './playwright-test-results',
      './test-results',
    ];

    for (const file of tempFiles) {
      try {
        const fullPath = path.resolve(file);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          // Remove directory recursively if it exists and is empty
          const files = await fs.readdir(fullPath);
          if (files.length === 0) {
            await fs.rmdir(fullPath);
          }
        } else {
          await fs.unlink(fullPath);
        }
      } catch (_error) {
        // File doesn't exist or can't be removed, that's okay
      }
    }
  } catch (_error) {
    // Don't throw here as cleanup failures shouldn't fail the test run
  }
}

export default globalTeardown;
