const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DocumentStore, MAX_BYTES } = require('../electron/documents.cjs');

test('open preserves UTF-8 source and refuses to overwrite an externally changed file', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-'));
  try {
    const target = path.join(folder, 'note.md');
    const original = '\ufeff# नमस्ते\r\n\r\n*unusual spacing*  \r\n';
    await fs.writeFile(target, original);
    const store = new DocumentStore();
    assert.deepEqual(await store.open(target), { path: target, text: original, dirty: false });
    await fs.writeFile(target, '# changed elsewhere');
    await assert.rejects(() => store.save(target, '# my edit'), /changed outside mdlite/);
    assert.equal(await fs.readFile(target, 'utf8'), '# changed elsewhere');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('binary Markdown is rejected without replacing the active document', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-'));
  try {
    const target = path.join(folder, 'binary.md');
    await fs.writeFile(target, 'abc\u0000def');
    const store = new DocumentStore('keep');
    await assert.rejects(() => store.open(target), /binary/);
    assert.equal(store.text, 'keep');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});
