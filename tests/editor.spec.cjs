const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let app, window, userData;
test.beforeEach(async () => {
  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-gui-'));
  const executablePath = process.env.MDLITE_EXECUTABLE_PATH;
  const args = executablePath ? [] : [root];
  if (process.platform === 'linux') args.push('--no-sandbox');
  app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args, env: { ...process.env, MDLITE_TEST_USER_DATA: userData } });
  window = await app.firstWindow();
  await expect(window.locator('.ProseMirror')).toBeVisible();
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
});
test.afterEach(async () => {
  if (app) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
    await app.close();
  }
  if (userData) await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
});

test('launches the editor with labelled modes and a document', async () => {
  for (const name of ['Edit','Read','Source']) await expect(window.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(window.locator('.ProseMirror')).toContainText('A little space to think');
  await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
  await window.screenshot({ path: path.join(root, 'evidence', 'editor.png') });
});

test('new creates an empty document and rich edits reach the native snapshot', async () => {
  await window.getByRole('button', { name: 'New', exact: true }).click();
  await expect(window.locator('.ProseMirror')).toHaveText('');
  await window.locator('.ProseMirror').fill('Hello local notes');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'Hello local notes',dirty:true});
  await expect(window.locator('#word-count')).toHaveText('3 words');
  await window.getByRole('button', { name:'Source', exact:true }).click();
  await expect(window.getByLabel('Markdown source')).toHaveValue('Hello local notes');
  await window.getByRole('button', { name:'Read', exact:true }).click();
  await expect(window.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
});

test('switching modes and saving preserves exact opened source', async () => {
  const original = '\ufeff# Hello\r\n\r\n*odd spacing*  \r\n\r\n<script>evil()</script>\r\n![picture](file:///etc/passwd)\r\n';
  const target = path.join(userData, 'original.md');
  const saved = path.join(userData, 'copy.md');
  await fs.writeFile(target, original);
  await app.evaluate(({dialog}, target) => { dialog.showOpenDialog = async () => ({ canceled:false, filePaths:[target] }); }, target);
  await window.getByRole('button', { name:'Open', exact:true }).click();
  await expect(window.locator('#document-name')).toHaveText('original.md');
  await expect(window.locator('.ProseMirror script')).toHaveCount(0);
  await expect(window.locator('.ProseMirror img[src]')).toHaveCount(0);
  await expect(window.locator('.image-placeholder')).toHaveCount(1);
  await window.getByRole('button', { name:'Source', exact:true }).click();
  await expect(window.locator('#source-warning')).toBeVisible();
  await window.getByRole('button', { name:'Read', exact:true }).click();
  await window.getByRole('button', { name:'Edit', exact:true }).click();
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:original, dirty:false});
  await app.evaluate(({dialog}, saved) => { dialog.showSaveDialog = async () => ({ canceled:false, filePath:saved }); }, saved);
  await window.getByRole('button', { name:'Save as', exact:true }).click();
  await expect.poll(async () => fs.readFile(saved, 'utf8').catch(() => null)).toBe(original);
});

test('source edits and formatting flow through real bridge', async () => {
  await window.getByRole('button', { name:'New', exact:true }).click();
  await window.getByRole('button', { name:'Source', exact:true }).click();
  await window.getByLabel('Markdown source').fill('# Heading\n\nA **bold** word');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'# Heading\n\nA **bold** word',dirty:true});
  await window.getByRole('button', { name:'Edit', exact:true }).click();
  await expect(window.locator('.ProseMirror h1')).toHaveText('Heading');
  await expect(window.locator('.ProseMirror strong')).toHaveText('bold');
  await expect(window.getByRole('navigation', {name:'Document outline'})).toContainText('Heading');
  await window.getByRole('button', { name:'Read', exact:true }).click();
  await expect(window.getByRole('button', {name:'Bold'})).toBeDisabled();
});

test('undo cannot resurrect content from a previous document', async () => {
  await window.getByRole('button', {name:'New', exact:true}).click();
  await window.locator('.ProseMirror').fill('Previous private text');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'Previous private text',dirty:true});
  await window.getByRole('button', {name:'New', exact:true}).click();
  await expect(window.locator('.ProseMirror')).toHaveText('');
  await window.locator('.ProseMirror').press('ControlOrMeta+z');
  await expect(window.locator('.ProseMirror')).toHaveText('');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'',dirty:false});
});

test('formatting buttons and keyboard undo affect saved Markdown', async () => {
  await window.getByRole('button', {name:'New', exact:true}).click();
  const edit = window.locator('.ProseMirror');
  await edit.fill('Formatted words');
  await edit.press('ControlOrMeta+a');
  await window.getByRole('button', {name:'Bold'}).click();
  await expect(edit.locator('strong')).toHaveText('Formatted words');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'**Formatted words**',dirty:true});
  await window.getByRole('button', {name:'Source',exact:true}).click();
  await window.getByRole('button', {name:'Edit',exact:true}).click();
  await edit.press('ControlOrMeta+z');
  await expect(edit.locator('strong')).toHaveCount(0);
});

test('rejected native save is displayed without dropping edits', async () => {
  await window.getByRole('button', {name:'New', exact:true}).click();
  await window.locator('.ProseMirror').fill('Retain this');
  await app.evaluate(({dialog}) => { dialog.showSaveDialog = async () => { throw new Error('Disk unavailable'); }; });
  await window.getByRole('button', {name:'Save',exact:true}).click();
  await expect(window.locator('#status')).toContainText('Disk unavailable');
  await expect.poll(() => window.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'Retain this',dirty:true});
});
