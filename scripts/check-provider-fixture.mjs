import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {root} from '../src/paths.mjs';

const result = spawnSync(process.execPath, [path.join(root,'scripts/verify-offline.mjs'),'--suite','provider'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, REASON_PROTO_OFFLINE: '1' },
});
process.exitCode = result.status ?? 1;
