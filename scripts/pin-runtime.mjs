import fs from 'node:fs';
import path from 'node:path';
import { root, resolvePrototypePaths } from '../src/paths.mjs';
import { sha256 } from './audit-baseline.mjs';

// This manifest pins the stock baseline; the candidate build owns its own manifest.
const paths = resolvePrototypePaths(root, 'stock');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/verification/baseline.json'), 'utf8'));
const source = path.resolve('D:/pi-clean/runtime/node_modules/@earendil-works/pi-coding-agent/dist');
const files = {};
for (const [file, hash] of Object.entries(baseline.entries)) {
  if (!file.startsWith(source + path.sep)) continue;
  const relative = path.relative(source, file);
  const local = path.join(paths.pkg, 'dist', relative);
  if (sha256(fs.readFileSync(local)) !== hash) throw new Error(`Upstream hash differs: ${relative}`);
  files[path.relative(root, local).replaceAll('\\', '/')] = hash;
}
for (const file of ['runtime/package.json', 'runtime/package-lock.json', 'runtime/exports.mjs', 'agent/bin/fd.exe', 'runtime/node_modules/@earendil-works/pi-coding-agent/package.json']) {
  files[file] = sha256(fs.readFileSync(path.join(root, file)));
}
function walk(directory) {
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Linked runtime dependency: ${file}`);
    if (stat.isDirectory()) walk(file);
    else if (stat.isFile()) files[path.relative(root, file).replaceAll('\\', '/')] = sha256(fs.readFileSync(file));
  }
}
walk(path.join(paths.runtime, 'node_modules'));
if (Object.keys(files).length < 100) throw new Error('Incomplete runtime identity');
const identityPath = path.join(root, 'config/runtime-identity.json');
if (fs.existsSync(identityPath)) {
  // Extending coverage may add files, but must not bless drift in any already-pinned file.
  const previous = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  const refreshedLockFiles = new Set(['runtime/package.json', 'runtime/package-lock.json', 'runtime/node_modules/.package-lock.json']);
  for (const [file, hash] of Object.entries(previous.files)) {
    if (process.argv.includes('--refresh-lock') && refreshedLockFiles.has(file)) continue;
    if (files[file] !== hash) throw new Error(`Previously pinned file changed: ${file}`);
  }
}
fs.writeFileSync(identityPath, JSON.stringify({ version: '1.0.0', source: 'baseline snapshot; official pinned helper dependencies installed with --ignore-scripts; full installed tree', files }, null, 2));
console.log(JSON.stringify({ matchedRuntimeFiles: Object.keys(files).length }));
