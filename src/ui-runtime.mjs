import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {resolvePrototypePaths} from './paths.mjs';

// Resolve the public TUI entry from the SDK's pinned dependency tree.
const require = createRequire(path.join(resolvePrototypePaths().pkg,'package.json'));
export const tui = await import(pathToFileURL(require.resolve('@earendil-works/pi-tui')).href);
