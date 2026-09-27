#!/usr/bin/env node

/**
 * Installs git hooks, but only where they mean something.
 *
 * npm runs `prepare` on every install, including `npm ci --omit=dev` inside a
 * production image - where husky is a devDependency and therefore absent, and
 * where there is no .git directory either. Calling husky directly from
 * `prepare` makes that install fail with "husky: not found" (exit 127), which
 * is exactly how the Docker build broke.
 *
 * Skipping is the correct behaviour here: hooks guard commits, and nothing
 * commits from inside a container or a CI runner.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const skip =
    process.env.HUSKY === '0' || // the documented opt-out
    process.env.CI === 'true' || // hooks never run on a CI runner
    !existsSync('node_modules/husky') || // production install: devDeps omitted
    !existsSync('.git'); // no repository to attach hooks to

if (skip) process.exit(0);

// `prepare` runs as an npm script, so node_modules/.bin is already on PATH.
const result = spawnSync('husky', { stdio: 'inherit', shell: true });

process.exit(result.status ?? 0);
