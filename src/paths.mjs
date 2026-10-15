import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const protectedRoots = ['D:/pi-clean', 'C:/Users/M S I/.pi'].map(p => path.resolve(p));

export function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Resolve existing ancestors too: a missing child beneath a junction is not isolated.
export function canonicalPath(candidate) {
  const absolute = path.resolve(candidate);
  if (fs.existsSync(absolute)) return fs.realpathSync.native(absolute);
  const parent = path.dirname(absolute);
  if (parent === absolute) throw new Error('Cannot canonicalize path');
  return path.join(canonicalPath(parent), path.basename(absolute));
}

export function resolvePrototypePaths(base = root, selectionOverride) {
  const runtime = path.join(base, 'runtime');
  const selectionFile=path.join(base,'config/runtime-selection.json');
  const selection=selectionOverride??(fs.existsSync(selectionFile)?JSON.parse(fs.readFileSync(selectionFile,'utf8')).runtime:'stock');
  if(!['stock','transcript-hook-v1'].includes(selection))throw new Error('RUNTIME_SELECTION_REJECTED');
  const stockPkg=path.join(runtime, 'node_modules/@earendil-works/pi-coding-agent');
  const pkg = selection==='stock'?stockPkg:path.join(base,'upstream-patches/transcript-hook/build/package');
  const agent = path.join(base, 'agent');
  return { root: base, runtime, pkg, stockPkg, selection,
    runtimeLabel:selection==='stock'?'1.0.0':'1.0.0+reason-ui.3',
    runtimeExports:selection==='stock'?path.join(runtime,'exports.mjs'):path.join(pkg,'prototype-exports.mjs'),
    cli: path.join(pkg, selection==='stock'?'dist/bundle/cli.js':'dist/cli.js'),
    sdk: path.join(pkg, 'dist/index.js'), agent, sessions: path.join(agent, 'sessions'),
    extension: path.join(base, 'extensions/harness.ts'),
    networkGuard: path.join(base, 'src/offline-guard.mjs') };
}
