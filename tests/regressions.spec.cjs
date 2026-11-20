const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let app, page, folder;
test.beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-regression-'));
  app = await electron.launch({ executablePath: process.env.MDLITE_EXECUTABLE_PATH || undefined,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(process.env.MDLITE_EXECUTABLE_PATH ? [] : [path.resolve(__dirname, '..')])],
    env: { ...process.env, MDLITE_TEST_USER_DATA: path.join(folder, 'profile') } });
  page = await app.firstWindow();
  await expect(page.locator('.ProseMirror')).toBeVisible();
});
test.afterEach(async () => {
  await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy()));
  await app?.close();
  await fs.rm(folder, { recursive:true, force:true, maxRetries:5, retryDelay:300 });
});

test('code less-than survives display and an unrelated rich edit', async () => {
  const target = path.join(folder, 'code.md');
  await fs.writeFile(target, '# Title\n\n```js\nif (a < b) return a;\n```\n\nInline `a < b`.\n\n<script>alert(1)</script>\n');
  await app.evaluate(({dialog}, target) => { dialog.showOpenDialog = async () => ({canceled:false,filePaths:[target]}); }, target);
  await page.getByRole('button',{name:'Open',exact:true}).click();
  await expect(page.locator('pre code')).toHaveText('if (a < b) return a;');
  await expect(page.locator('.ProseMirror script')).toHaveCount(0);
  await page.locator('.ProseMirror h1').click();
  await page.keyboard.press('End'); await page.keyboard.type('!');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(() => fs.readFile(target,'utf8')).toContain('if (a < b) return a;');
  expect(await fs.readFile(target,'utf8')).toContain('`a < b`');
});

test('close synchronizes edits before main checks dirty state', async () => {
  await page.getByRole('button',{name:'New',exact:true}).click();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await app.evaluate(({dialog}) => { global.closePrompts=0; dialog.showMessageBox=async()=>{global.closePrompts++;return {response:2};}; });
  // Dispatch input and a close request in one renderer turn: changed() is queued.
  await page.evaluate(() => {
    const source=document.querySelector('#source'); source.value='latest queued edit';
    source.dispatchEvent(new Event('input',{bubbles:true})); window.close();
  });
  await expect.poll(() => app.evaluate(() => global.closePrompts)).toBe(1);
  expect(app.windows()).toHaveLength(1);
  expect(await page.evaluate(() => window.mdlite.getDocument())).toMatchObject({text:'latest queued edit',dirty:true});
});

test('invalid draft remains protected on close and cannot be saved as clean', async () => {
  await page.getByRole('button',{name:'New',exact:true}).click();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  const target=path.join(folder,'invalid.md');
  await app.evaluate(({dialog}, target) => {
    global.closePrompts=0;
    dialog.showMessageBox=async()=>{global.closePrompts++;return {response:2};};
    dialog.showSaveDialog=async()=>({canceled:false,filePath:target});
  },target);
  await page.getByLabel('Markdown source').fill('before\u0000after');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#status')).toContainText('NUL');
  await page.evaluate(()=>window.close());
  await expect.poll(()=>app.evaluate(()=>global.closePrompts)).toBe(1);
  expect(app.windows()).toHaveLength(1);
  expect(await fs.stat(target).catch(()=>null)).toBeNull();
});

test('large real clipboard paste remains dirty and native close prompts', async () => {
  test.setTimeout(60000);
  await page.getByRole('button',{name:'New',exact:true}).click();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await app.evaluate(({clipboard,dialog})=>{
    clipboard.writeText('x'.repeat(10*1024*1024+1));
    global.closePrompts=0;
    dialog.showMessageBox=async()=>{global.closePrompts++;return {response:2};};
  });
  await page.getByLabel('Markdown source').click();
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(()=>page.locator('#source').evaluate(el=>el.value.length), {timeout:20000}).toBe(10485761);
  await expect.poll(()=>page.evaluate(async()=>{const doc=await window.mdlite.getDocument();return {length:doc.text.length,dirty:doc.dirty};})).toEqual({length:10485761,dirty:true});
  expect(errors).toEqual([]);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await expect.poll(()=>app.evaluate(()=>global.closePrompts)).toBe(1);
  expect(app.windows()).toHaveLength(1);
});
