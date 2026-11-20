const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DocumentStore, MAX_BYTES } = require('../electron/documents.cjs');

async function fixture(run) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-'));
  try { await run(folder); }
  finally { await fs.rm(folder, { recursive: true, force: true }); }
}

test('save publishes Unicode edits, resets dirty state and leaves no temporary file', () => fixture(async folder => {
  const target = path.join(folder, '新しい.md');
  const store = new DocumentStore();
  store.changed('# hello 🌿\n');
  assert.equal(store.snapshot().dirty, true);
  assert.deepEqual(await store.save(target, store.text), { path: target, text: '# hello 🌿\n', dirty: false });
  assert.equal(await fs.readFile(target, 'utf8'), '# hello 🌿\n');
  assert.deepEqual(await fs.readdir(folder), ['新しい.md']);
  store.changed('changed');
  assert.deepEqual(store.reset(), { path: null, text: '', dirty: false });
}));

test('invalid UTF-8, oversize input and failed reads leave current document untouched', () => fixture(async folder => {
  const store = new DocumentStore('keep me');
  const target = path.join(folder, 'bad.md');
  await fs.writeFile(target, Buffer.from([0xff, 0xfe]));
  await assert.rejects(() => store.open(target), /not valid UTF-8/);
  await fs.writeFile(target, Buffer.alloc(MAX_BYTES + 1));
  await assert.rejects(() => store.open(target), /smaller than 10 MB/);
  await assert.rejects(() => store.open(path.join(folder, 'missing.md')), /ENOENT/);
  assert.throws(() => store.changed({ text: 'bad' }), /UTF-8 text/);
  assert.throws(() => store.changed('x'.repeat(MAX_BYTES + 1)), /smaller than 10 MB/);
  assert.deepEqual(store.snapshot(), { path: null, text: 'keep me', dirty: false });
}));

test('Save as refuses unconfirmed replacement and unsupported extensions', () => fixture(async folder => {
  const target = path.join(folder, 'existing.md');
  const store = new DocumentStore();
  await fs.writeFile(target, 'original');
  await assert.rejects(() => store.save(target, 'replacement'), /already exists/);
  assert.equal(await fs.readFile(target, 'utf8'), 'original');
  await assert.rejects(() => store.save(path.join(folder, 'oops.txt'), 'replacement'), /extension/);
  await store.save(target, 'replacement', true);
  assert.equal(await fs.readFile(target, 'utf8'), 'replacement');
}));

test('failed publication keeps unsaved edits and removes temporary file', () => fixture(async folder => {
  const store = new DocumentStore();
  store.changed('my unsaved work');
  const target = path.join(folder, 'missing', 'note.md');
  await assert.rejects(() => store.save(target, store.text), /ENOENT/);
  assert.equal(store.snapshot().dirty, true);
  assert.equal(store.path, null);
  assert.deepEqual(await fs.readdir(folder), []);
}));
