#!/usr/bin/env node
// Pack the project into a versioned .mcpb file: <name>-<version>.mcpb
// Reads version from manifest.json (the source of truth for the bundle).

import { spawnSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const manifest = JSON.parse(readFileSync(join(projectRoot, 'manifest.json'), 'utf8'));
const { name, version } = manifest;
if (!name || !version) {
  console.error('manifest.json must contain "name" and "version"');
  process.exit(1);
}

const outputFile = `${name}-${version}.mcpb`;
const outputPath = join(projectRoot, outputFile);

// Remove a stale artifact with the same name so mcpb doesn't include it.
if (existsSync(outputPath)) unlinkSync(outputPath);

// Also remove the legacy unversioned file if it exists, so consumers don't
// accidentally install an old build.
const legacy = join(projectRoot, `${name}.mcpb`);
if (existsSync(legacy)) unlinkSync(legacy);

const result = spawnSync('mcpb', ['pack', '.', outputFile], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(`mcpb pack failed with status ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log(`\nPacked: ${outputFile}`);
