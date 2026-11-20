const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_BYTES = 10 * 1024 * 1024;

function validateText(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_BYTES) {
    throw new Error('Markdown must be UTF-8 text smaller than 10 MB.');
  }
  if (text.includes('\u0000')) throw new Error('Markdown cannot contain NUL characters. Remove them before saving.');
}

async function readMarkdown(target) {
  const handle = await fs.open(target, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Choose a Markdown file smaller than 10 MB.');
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < bytes.length) {
      const chunk = await handle.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead);
      if (chunk.bytesRead === 0) break;
      bytesRead += chunk.bytesRead;
    }
    if (bytesRead > MAX_BYTES) throw new Error('Choose a Markdown file smaller than 10 MB.');
    if (bytes.subarray(0, bytesRead).includes(0)) throw new Error('This appears to be a binary file, not Markdown.');
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, bytesRead));
    } catch { throw new Error('This file is not valid UTF-8. Convert it to UTF-8 before opening.'); }
  } finally { await handle.close(); }
}

class DocumentStore {
  constructor(text = '') {
    this.path = null;
    this.text = text;
    this.savedText = text;
  }

  snapshot() { return { path: this.path, text: this.text, dirty: this.text !== this.savedText }; }

  changed(text) {
    // Retain even an invalid/oversize draft so close protection cannot lose it.
    // The stricter file policy belongs at open/save, not draft synchronization.
    if (typeof text !== 'string') throw new Error('Markdown must be UTF-8 text.');
    this.text = text;
  }

  reset() { this.path = null; this.text = ''; this.savedText = ''; return this.snapshot(); }

  async open(target) {
    const text = await readMarkdown(target);
    this.path = path.resolve(target);
    this.text = text;
    this.savedText = text;
    return this.snapshot();
  }

  async save(target, text, overwrite = false) {
    validateText(text);
    target = path.resolve(target);
    if (!/\.(md|markdown)$/i.test(target)) throw new Error('Save with a .md or .markdown extension.');
    let existing;
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Save to a regular file, not a link or folder.');
      existing = await readMarkdown(target);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (target === this.path && existing !== this.savedText) {
      throw new Error('This file changed outside mdlite. Use Save as to keep both versions.');
    }
    if (target !== this.path && existing !== undefined && !overwrite) {
      throw new Error('The destination already exists. Confirm replacement first.');
    }
    const temporary = path.join(path.dirname(target), `.mdlite-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' });
      // Same-directory rename avoids a partially written document after ordinary write failures.
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
    this.path = target;
    this.text = text;
    this.savedText = text;
    return this.snapshot();
  }
}
module.exports = { DocumentStore, readMarkdown, validateText, MAX_BYTES };
