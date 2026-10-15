import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { root } from '../src/paths.mjs';

const snapshotPath = path.join(root, 'artifacts/verification/baseline.json');
const inputs = [
  'D:/pi-clean/launch.mjs', 'D:/pi-clean/shared-brain.md',
  'D:/pi-clean/agent/settings.json', 'D:/pi-clean/agent/models.json', 'D:/pi-clean/agent/auth.json',
  'D:/pi-clean/runtime/package.json', 'D:/pi-clean/runtime/package-lock.json',
  'D:/pi-clean/runtime/node_modules/@earendil-works/pi-coding-agent/dist',
  'C:/Users/M S I/.pi/agent/settings.json', 'C:/Users/M S I/.pi/agent/models.json', 'C:/Users/M S I/.pi/agent/auth.json',
  'C:/Users/M S I/.pi/agent/extensions', 'C:/Users/M S I/.pi/agent/AGENTS.md',
  'C:/Users/M S I/.pi/runtime-src/packages',
  'C:/Users/M S I/.pi/runtime-src/package.json', 'C:/Users/M S I/.pi/runtime-src/package-lock.json',
  'C:/Users/M S I/AppData/Roaming/npm/pi', 'C:/Users/M S I/AppData/Roaming/npm/pi.cmd', 'C:/Users/M S I/AppData/Roaming/npm/pi.ps1',
  'C:/Users/M S I/.local/bin/pi-clean.cmd', 'C:/Users/M S I/.local/bin/pi-clean.ps1'
];
const ignored = new Set(['node_modules', '.git', '.cache', 'coverage']);
export const sha256 = data => createHash('sha256').update(data).digest('hex');
function inventory() {
  const entries = {};
  function walk(file) {
    if (!fs.existsSync(file)) { entries[file] = null; return; }
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) { entries[file] = `link:${fs.readlinkSync(file)}`; return; }
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(file).sort()) if (!ignored.has(item)) walk(path.join(file, item));
    } else if (stat.isFile()) entries[file] = sha256(fs.readFileSync(file));
  }
  for (const input of inputs) walk(path.resolve(input));
  return entries;
}
export function auditBaseline(mode = '--check') {
  if (!['--check', '--freeze'].includes(mode)) throw new Error('Use --check or --freeze');
  const entries = inventory();
  if (mode === '--freeze') {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify({ createdAt: new Date().toISOString(), inputs, entries }, null, 2), { flag: 'wx' });
    return { passed: true, frozenFiles: Object.keys(entries).length };
  }
  const before = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).entries;
  const changed = [...new Set([...Object.keys(before), ...Object.keys(entries)])].filter(key => before[key] !== entries[key]);
  let toolSourcesChecked=0;
  const toolManifest=path.join(root,'config/tool-binaries.json');
  if(fs.existsSync(toolManifest))for(const tool of Object.values(JSON.parse(fs.readFileSync(toolManifest,'utf8')))){
    toolSourcesChecked++;
    if(!fs.existsSync(tool.source)||sha256(fs.readFileSync(tool.source))!==tool.sha256)changed.push(tool.source);
  }
  return { passed: changed.length === 0, checkedFiles: Object.keys(before).length, toolSourcesChecked, changed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = auditBaseline(process.argv[2]);
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}
