const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
let app, page, folder;

test.beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlite-native-'));
  app = await electron.launch({
    executablePath: process.env.MDLITE_EXECUTABLE_PATH || undefined,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(process.env.MDLITE_EXECUTABLE_PATH ? [] : [path.join(__dirname, '..')])],
    env: { ...process.env, MDLITE_TEST_USER_DATA: path.join(folder, 'profile') },
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.mdlite));
});
test.afterEach(async () => {
  await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
  await app?.close();
  await fs.rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
});

test('native open/save uses real disk, rejects external conflicts and preserves on canceled open', async () => {
  const target = path.join(folder, 'test.md');
  await fs.writeFile(target, '# original\r\n');
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, target);
  expect(await page.evaluate(() => window.mdlite.open())).toMatchObject({ text: '# original\r\n', dirty: false });
  await page.evaluate(() => window.mdlite.changed('# edited'));
  expect(await page.evaluate(() => window.mdlite.save('# edited'))).toMatchObject({ dirty: false });
  expect(await fs.readFile(target, 'utf8')).toBe('# edited');
  await fs.writeFile(target, '# outside');
  await expect(page.evaluate(() => window.mdlite.save('# conflict'))).rejects.toThrow(/changed outside/);
  expect(await fs.readFile(target, 'utf8')).toBe('# outside');
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 2 }); });
  expect(await page.evaluate(() => window.mdlite.open())).toBeNull();
  expect(await page.evaluate(() => window.mdlite.getDocument())).toMatchObject({ text: '# conflict', dirty: true });
});

test('save cancellation prevents New, explicit discard allows New and failed save retains edits', async () => {
  await page.evaluate(() => window.mdlite.changed('unsaved'));
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0 });
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  expect(await page.evaluate(() => window.mdlite.newDocument())).toBeNull();
  expect(await page.evaluate(() => window.mdlite.getDocument())).toMatchObject({ text: 'unsaved', dirty: true });
  const target = path.join(folder, 'missing', 'save.md');
  await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }); }, target);
  await expect(page.evaluate(() => window.mdlite.save('still unsaved', true))).rejects.toThrow(/ENOENT/);
  expect(await page.evaluate(() => window.mdlite.getDocument())).toMatchObject({ text: 'still unsaved', dirty: true });
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
  expect(await page.evaluate(() => window.mdlite.newDocument())).toEqual({ path: null, text: '', dirty: false });
});

test('close cancel retains the real window; renderer has no Node access or popup permission', async () => {
  expect(await page.evaluate(() => typeof process)).toBe('undefined');
  expect(await page.evaluate(() => typeof require)).toBe('undefined');
  await page.evaluate(() => window.mdlite.changed('keep this'));
  await app.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showMessageBox = async () => ({ response: 2 });
    BrowserWindow.getAllWindows()[0].close();
  });
  await expect.poll(() => app.windows().length).toBe(1);
  expect(await page.evaluate(() => window.mdlite.getDocument())).toMatchObject({ text: 'keep this', dirty: true });
  await page.evaluate(() => window.open('https://example.com'));
  expect(app.windows()).toHaveLength(1);
});
