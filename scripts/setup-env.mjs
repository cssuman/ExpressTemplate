#!/usr/bin/env node

/**
 * First-run setup: creates a usable .env file from .env.example.
 *
 * The one value that cannot have a sensible default is API_KEY - a shared
 * secret is only a secret if it is random - so this generates one rather than
 * leaving a placeholder that people ship to production by accident.
 *
 *   npm run setup                    -> .env.local      (development)
 *   npm run setup -- .env.production -> .env.production (docker compose)
 */

import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const SOURCE = '.env.example';
const target = process.argv[2] ?? '.env.local';

if (!existsSync(SOURCE)) {
    console.error(`✖ ${SOURCE} not found. Are you in the repository root?`);
    process.exit(1);
}

// Never clobber real credentials.
if (existsSync(target)) {
    console.log(`✔ ${target} already exists - leaving it untouched.`);
    process.exit(0);
}

const apiKey = randomBytes(32).toString('hex');

const contents = readFileSync(SOURCE, 'utf8').replace('API_KEY=replace_me_with_a_long_random_value', `API_KEY=${apiKey}`);

writeFileSync(target, contents, { mode: 0o600 });

console.log(`✔ Created ${target} with a freshly generated API_KEY.`);
console.log(`  Review CLIENT_URL before pointing a real frontend at it.`);
console.log(`\n  Next: npm run dev\n`);
