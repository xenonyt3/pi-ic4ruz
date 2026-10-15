import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sdk } from '../src/upstream.mjs';
import { root } from '../src/paths.mjs';
import { canonicalizeAllowedPath } from '../src/tool-policy.ts';

const base = path.join(root, 'tests', '.tmp-files');
fs.mkdirSync(base, { recursive: true });
const cwd = fs.mkdtempSync(path.join(base, 'files-'));
test.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
const run = (tool, input) => tool.execute('fixture-call', input, undefined, undefined, undefined);

test('O05 upstream read pages UTF-8, spaces, Unicode, BOM and CRLF', async () => {
  const file = path.join(cwd, 'a space 文档.txt');
  fs.writeFileSync(file, '\ufeffalpha\r\nbeta\r\ngamma\r\n');
  const read = sdk.createReadToolDefinition(cwd);
  const first = await run(read, { path: file, offset: 1, limit: 1 });
  assert.match(first.content[0].text, /alpha/);
  assert.doesNotMatch(first.content[0].text, /gamma/);
  const second = await run(read, { path: file, offset: 2, limit: 1 });
  assert.match(second.content[0].text, /beta/);
  await assert.rejects(run(read, { path: file, offset: 999 }), /offset|line/i);
});

test('O05 upstream edit uses original snapshot and preserves BOM/CRLF', async () => {
  const file = path.join(cwd, 'edit 文档.txt');
  fs.writeFileSync(file, '\ufeffalpha\r\nbeta\r\ngamma\r\n');
  const edit = sdk.createEditToolDefinition(cwd);
  await run(edit, { path: file, edits: [
    { oldText: 'alpha', newText: 'ALPHA' },
    { oldText: 'gamma', newText: 'GAMMA' },
  ] });
  assert.equal(fs.readFileSync(file, 'utf8'), '\ufeffALPHA\r\nbeta\r\nGAMMA\r\n');
  const prior = fs.readFileSync(file);
  await assert.rejects(run(edit, { path: file, edits: [{ oldText: 'beta', newText: 'x' }, { oldText: 'beta', newText: 'y' }] }), /overlap|duplicate|same|unique/i);
  assert.deepEqual(fs.readFileSync(file), prior);
  await assert.rejects(run(edit, { path: file, edits: [{ oldText: 'missing', newText: 'x' }] }), /not found|match/i);
  assert.deepEqual(fs.readFileSync(file), prior);
});

test('O05 upstream write creates parents, then replaces file; directory target errors', async () => {
  const write = sdk.createWriteToolDefinition(cwd);
  const file = path.join(cwd, 'nested space', '深', 'new.txt');
  await run(write, { path: file, content: 'first' });
  await run(write, { path: file, content: 'second' });
  assert.equal(fs.readFileSync(file, 'utf8'), 'second');
  await assert.rejects(run(write, { path: path.dirname(file), content: 'wrong' }), /EISDIR|EPERM|access|directory/i);
});

test('O05 upstream read returns image block for PNG and reports binary files', async () => {
  const png = path.join(cwd, 'pixel.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK38AAAAASUVORK5CYII=', 'base64'));
  const read = sdk.createReadToolDefinition(cwd, { autoResizeImages: false });
  const result = await run(read, { path: png });
  assert.ok(result.content.some(block => block.type === 'image'));
  const binary = path.join(cwd, 'binary.dat');
  fs.writeFileSync(binary, Buffer.from([0, 1, 2, 255]));
  const binaryResult = await run(read, { path: binary });
  assert.ok(binaryResult.content.some(block => block.type === 'text'));
});
test('O05 line/byte boundaries, non-unique edit and junction escape',async()=>{
  const file=path.join(cwd,'limits.txt');fs.writeFileSync(file,Array.from({length:2105},(_,i)=>`line-${i}`).join('\n'));
  const read=sdk.createReadToolDefinition(cwd);const text=(await run(read,{path:file})).content.map(item=>item.text??'').join('\n');
  assert.match(text,/line-1999/);assert.doesNotMatch(text,/line-2004/);
  fs.writeFileSync(file,'x'.repeat(60000));assert.match((await run(read,{path:file})).content[0].text,/limit|exceed/i);
  fs.writeFileSync(file,'same same');const prior=fs.readFileSync(file);await assert.rejects(run(sdk.createEditToolDefinition(cwd),{path:file,edits:[{oldText:'same',newText:'changed'}]}),/unique|occurrence|match/i);assert.deepEqual(fs.readFileSync(file),prior);
  const link=path.join(cwd,'outside-link');fs.symlinkSync(base,link,'junction');
  try{assert.throws(()=>canonicalizeAllowedPath(path.join(link,'other.txt'),cwd),/OUTSIDE/);}finally{fs.rmdirSync(link);}
});
test('O05 native upstream find/grep/ls work offline with isolated executable cache',async()=>{
  const file=path.join(cwd,'find-target.txt');fs.writeFileSync(file,'offline-search-needle');
  const found=await run(sdk.createFindToolDefinition(cwd),{pattern:'find-target.txt'});
  assert.match(found.content[0].text,/find-target\.txt/);
  const grep=await run(sdk.createGrepToolDefinition(cwd),{pattern:'offline-search-needle',path:cwd});assert.match(grep.content[0].text,/find-target\.txt/);
  const ls=await run(sdk.createLsToolDefinition(cwd),{path:cwd});assert.match(ls.content[0].text,/find-target\.txt/);
});
