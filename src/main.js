import './style.css';
import './accessibility.css';
import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { marked } from 'marked';

// Make HTML tokens literal at the lexer boundary, leaving fenced/inline code
// tokens byte-for-byte intact. No raw HTML reaches TipTap's HTML parser.
function inertTokens(tokens) {
  for (const token of tokens) {
    if (token.type === 'html') {
      const literal = token.raw;
      Object.assign(token, { type: token.block ? 'paragraph' : 'text', text: literal,
        tokens: [{ type: 'text', raw: literal, text: literal }] });
    } else {
      if (token.tokens) inertTokens(token.tokens);
      if (token.items) inertTokens(token.items);
      for (const row of [token.header, ...(token.rows || [])]) if (row) inertTokens(row);
    }
  }
  return tokens;
}
class InertLexer extends marked.Lexer {
  lex(value) { return inertTokens(super.lex(value)); }
}
const inertMarkdown = { ...marked, Lexer: InertLexer };

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const source = $('#source');
let text = '', documentPath = null, dirty = false, mode = 'edit', busy = false, sourceEdited = false;
let changeQueue = Promise.resolve(), changeError = null;
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const SafeImage = Image.extend({
  renderHTML({ node }) { return ['span', { class: 'image-placeholder', role: 'img', 'aria-label': node.attrs.alt || 'Image' }, `▧  ${node.attrs.alt || 'Image'} (not loaded)`]; },
});
const editor = new Editor({
  element: $('#editor'),
  extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false } }), Markdown.configure({ marked: inertMarkdown }), TableKit, TaskList, TaskItem.configure({ nested: true }), SafeImage],
  content: '',
  editorProps: { attributes: { 'aria-label': 'Document editor', spellcheck: 'true' }, handleClick(view, pos, event) { if (event.target.closest('a')) { event.preventDefault(); return true; } return false; } },
  onUpdate() { if (!busy && mode === 'edit') { text = editor.getMarkdown(); dirty = true; sendChange(text); renderMeta(); } },
  onSelectionUpdate() { updateToolbar(); },
});

function parseForDisplay(value) { return value.replace(/^\uFEFF/, ''); }
function renderEditor(resetHistory = false) {
  editor.commands.setContent(parseForDisplay(text), { contentType: 'markdown', emitUpdate: false });
  if (resetHistory) editor.view.updateState(EditorState.create({ doc: editor.state.doc, schema: editor.schema, plugins: editor.state.plugins }));
  updateOutline(); updateToolbar();
}
function renderMeta() {
  const name = documentPath ? documentPath.split(/[\\/]/).pop() : 'Untitled';
  $('#document-name').textContent = name; $('#breadcrumb-name').textContent = name;
  $('#file-detail').textContent = dirty ? 'Unsaved changes' : documentPath ? 'Saved on your computer' : 'A fresh page';
  if (text.length > 1000000) {
    $('#word-count').textContent = 'Large document';
    $('#outline').replaceChildren();
    status('Large draft retained; word count and outline are paused. Files must be below 10 MB to save.');
    return;
  }
  const words = text.trim().match(/\S+/gu)?.length || 0;
  $('#word-count').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  updateOutline();
}
function updateOutline() {
  if (text.length > 1000000) { $('#outline').replaceChildren(); return; }
  const nav = $('#outline'); nav.replaceChildren();
  // Outline derives from parsed document; source mode shows headings in the current source.
  const headings = mode === 'source' ? [...text.matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map(m => ({ level: m[1].length, label: m[2] })) : [...$('#editor').querySelectorAll('h1,h2,h3,h4,h5,h6')].map(el => ({ level: Number(el.tagName[1]), label: el.textContent, element: el }));
  if (!headings.length) { const empty = document.createElement('p'); empty.className = 'outline-empty'; empty.textContent = 'Your headings will appear here.'; nav.append(empty); return; }
  headings.forEach(heading => { const button = document.createElement('button'); button.textContent = heading.label; button.className = `outline-item level-${Math.min(heading.level, 3)}`; button.addEventListener('click', () => heading.element?.scrollIntoView({ behavior: 'smooth', block: 'center' })); nav.append(button); });
}
function updateToolbar() {
  $$('[data-format]').forEach(button => { const key = button.dataset.format; button.classList.toggle('active', editor.isActive(key)); });
  const heading = [1,2,3].find(level => editor.isActive('heading', { level })); $('#typography').value = heading ? String(heading) : 'paragraph';
}
function applyDocument(doc) {
  if (!doc) return;
  text = doc.text; documentPath = doc.path; dirty = doc.dirty; sourceEdited = false;
  // A new document starts a new history: undo must never resurrect an older file.
  source.value = text; renderEditor(true);
  renderMeta(); status('Ready');
}
function sendChange(value) {
  changeQueue = changeQueue.catch(() => {}).then(async () => { await window.mdlite.changed(value); changeError = null; }).catch(error => { changeError = error; status(`Could not update document: ${error.message}`, true); });
}
function setBusy(value) {
  busy = value; document.body.classList.toggle('busy', value);
  $$('[data-action], [data-mode], [data-format], #typography').forEach(el => { el.disabled = value || (el.matches('[data-format], #typography') && mode !== 'edit'); });
  source.readOnly = value; editor.setEditable(!value && mode === 'edit', false);
}
async function action(name) {
  if (busy) return;
  setBusy(true);
  try {
    await changeQueue;
    if (changeError) throw changeError;
    let doc;
    if (name === 'close') { await window.mdlite.close(); return; }
    if (name === 'new') doc = await window.mdlite.newDocument();
    if (name === 'open') doc = await window.mdlite.open();
    if (name === 'save' || name === 'save-as') doc = await window.mdlite.save(text, name === 'save-as');
    if (doc && name.startsWith('save')) { documentPath = doc.path; dirty = doc.dirty; renderMeta(); status('Saved'); }
    else if (doc) applyDocument(doc);
  } catch (error) { status(`Could not ${name.replace('-', ' ')}: ${error.message}`, true); }
  finally { setBusy(false); }
}
function setMode(next) {
  if (busy || next === mode) return;
  if (mode === 'source' && sourceEdited && text.length > 1000000) {
    status('This large draft is available in Source. Reduce it before switching views.');
    return;
  }
  if (mode === 'source' && sourceEdited) { renderEditor(true); sourceEdited = false; }
  mode = next;
  source.hidden = next !== 'source'; $('#editor').hidden = next === 'source'; $('#source-warning').hidden = next !== 'source';
  if (next === 'source') source.value = text;
  $$('.modes button').forEach(button => { const selected = button.dataset.mode === mode; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('#mode-label').textContent = { edit: 'Editing', read: 'Reading', source: 'Markdown source' }[mode];
  setBusy(false); updateOutline();
}
$$('[data-action]').forEach(button => button.addEventListener('click', () => action(button.dataset.action)));
$$('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$$('[data-format]').forEach(button => button.addEventListener('click', () => {
  const command = button.dataset.format; let chain = editor.chain().focus();
  const methods = { bold:'toggleBold', italic:'toggleItalic', strike:'toggleStrike', bulletList:'toggleBulletList', orderedList:'toggleOrderedList', taskList:'toggleTaskList', codeBlock:'toggleCodeBlock', blockquote:'toggleBlockquote', horizontalRule:'setHorizontalRule', undo:'undo', redo:'redo' };
  if (command === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); else chain[methods[command]]().run();
  updateToolbar();
}));
$('#typography').addEventListener('change', event => { const chain = editor.chain().focus(); if (event.target.value === 'paragraph') chain.setParagraph().run(); else chain.toggleHeading({ level: Number(event.target.value) }).run(); });
source.addEventListener('input', () => { text = source.value; sourceEdited = true; dirty = true; sendChange(text); renderMeta(); });
document.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); });
document.addEventListener('keydown', event => { if (!(event.ctrlKey || event.metaKey) || event.altKey) return; const key = event.key.toLowerCase(); const name = key === 'n' ? 'new' : key === 'o' ? 'open' : key === 's' ? (event.shiftKey ? 'save-as' : 'save') : null; if (name) { event.preventDefault(); action(name); } });
window.close = () => { action('close'); };
window.addEventListener('beforeunload', event => {
  event.preventDefault();
  event.returnValue = false;
  action('close');
});
if (!window.mdlite) { setBusy(true); status('Native document bridge unavailable. Open mdlite in the desktop app.', true); }
else {
  window.mdlite.onCommand(action);
  window.mdlite.onDocument(doc => { if (doc) applyDocument(doc); });
  setBusy(true);
  window.mdlite.getDocument().then(applyDocument).catch(error => status(`Could not load document: ${error.message}`, true)).finally(() => setBusy(false));
}
