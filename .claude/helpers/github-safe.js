#!/usr/bin/env node

/**
 * Safe GitHub CLI Helper
 * Prevents timeout issues when using gh commands with special characters
 *
 * Usage:
 *   ./github-safe.js issue comment 123 "Message with `backticks`"
 *   ./github-safe.js pr create --title "Title" --body "Complex body"
 */

import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RANDOM_BYTES_LENGTH = 8;

const args = process.argv.slice(2);

if (args.length < 2) {
  process.exit(1);
}

const [command, subcommand, ...restArgs] = args;

// Handle commands that need body content
if (
  (command === 'issue' || command === 'pr') &&
  (subcommand === 'comment' || subcommand === 'create')
) {
  let bodyIndex = -1;
  let body;

  if (subcommand === 'comment' && restArgs.length >= 2) {
    // Simple format: github-safe.js issue comment 123 "body"
    body = restArgs[1];
    bodyIndex = 1;
  } else {
    // Flag format: --body "content"
    bodyIndex = restArgs.indexOf('--body');
    if (bodyIndex !== -1 && bodyIndex < restArgs.length - 1) {
      body = restArgs[bodyIndex + 1];
    }
  }

  // Always use temporary file for body content when body exists
  if (body) {
    // Use temporary file for body content
    const tmpFile = join(
      tmpdir(),
      `gh-body-${randomBytes(RANDOM_BYTES_LENGTH).toString('hex')}.tmp`
    );

    try {
      writeFileSync(tmpFile, body, 'utf8');

      // Build new command with --body-file
      const newArgs = [...restArgs];
      if (subcommand === 'comment' && bodyIndex === 1) {
        // Replace body with --body-file
        newArgs[1] = '--body-file';
        newArgs.push(tmpFile);
      } else if (bodyIndex !== -1) {
        // Replace --body with --body-file
        newArgs[bodyIndex] = '--body-file';
        newArgs[bodyIndex + 1] = tmpFile;
      }

      // Execute safely
      const ghCommand = `gh ${command} ${subcommand} ${newArgs.join(' ')}`;

      execSync(ghCommand, {
        stdio: 'inherit',
        timeout: 30_000, // 30 second timeout
      });
    } catch (_error) {
      process.exit(1);
    } finally {
      // Clean up
      try {
        unlinkSync(tmpFile);
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
  } else {
    // No body content, execute normally
    execSync(`gh ${args.join(' ')}`, { stdio: 'inherit' });
  }
} else {
  // Other commands, execute normally
  execSync(`gh ${args.join(' ')}`, { stdio: 'inherit' });
}
