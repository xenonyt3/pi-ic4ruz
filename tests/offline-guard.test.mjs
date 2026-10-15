import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { root } from '../src/paths.mjs';
import { run } from './helpers/process.mjs';

test('offline guard rejects fetch, Node sockets, HTTP and DNS before transport', async () => {
  const result = await run(['--import', pathToFileURL(path.join(root, 'src/offline-guard.mjs')).href, '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import net from 'node:net'; import http from 'node:http'; import dns from 'node:dns';
    await assert.rejects(fetch('http://127.0.0.1:9'), /OFFLINE_NETWORK_BLOCKED/);
    assert.throws(() => net.connect(9, '127.0.0.1'), /OFFLINE_NETWORK_BLOCKED/);
    assert.throws(() => http.get('http://127.0.0.1:9'), /OFFLINE_NETWORK_BLOCKED/);
    await assert.rejects(dns.promises.lookup('example.invalid'), /OFFLINE_NETWORK_BLOCKED/);
    assert.equal(globalThis.__prototypeOfflineCounters.blockedNetworkAttempts, 4);
    globalThis.__prototypeOfflineCounters.expectedBlockedAttempts = 4;
  `]);
  assert.equal(result.code, 0, result.stderr);
});

test('guard receipts retain both process lifetimes when Windows reuses a PID', async () => {
  const dir=fs.mkdtempSync(path.join(root,'artifacts/verification/receipt-reuse-'));
  const guard=pathToFileURL(path.join(root,'src/offline-guard.mjs')).href;
  for(const entrypoint of ['first-lifetime','second-lifetime']){
    const code=`Object.defineProperty(process,'pid',{value:424242}); process.argv[1]=${JSON.stringify(entrypoint)}; await import(${JSON.stringify(guard)});`;
    const result=await run(['--input-type=module','-e',code],{env:{...process.env,NODE_OPTIONS:'',PROTOTYPE_GUARD_DIR:dir}});
    assert.equal(result.code,0,result.stderr);
  }
  const receipts=fs.readdirSync(dir).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')));
  assert.equal(receipts.length,2);
  assert.deepEqual(receipts.map(receipt=>receipt.entrypoint).sort(),['first-lifetime','second-lifetime']);
  assert.ok(receipts.every(receipt=>receipt.pid===424242&&receipt.blockedNetworkAttempts===0));
});
